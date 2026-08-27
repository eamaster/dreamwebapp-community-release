/**
 * Payment routes — mounted at /api/v1/payments
 *
 *   GET  /currencies           -> list supported pay currencies
 *   POST /checkout             -> create invoice and order
 *   GET  /orders/:orderId      -> poll order status (authorized via status token or auth)
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { HonoVariables } from '../middleware/auth';
import { customerAuthMiddleware, type CustomerHonoVariables } from '../middleware/customer-auth';
import { createDB } from '../db';
import { rateLimiter } from '../middleware/ratelimit';
import { CACHE_CONTROL } from '../middleware/cache';
import { CheckoutRequestSchema, OrderStatusQuerySchema } from '../validators/schemas';
import { getCurrencies, getMinimumPaymentAmount, createInvoice, NowPaymentsError } from '../lib/payments/nowpayments-client';
import { getPlanPrice } from '../lib/payments/catalog';
import { isApprovedCurrency, filterAndOrderApprovedCurrencies } from '../lib/payments/currencies';
import { createOrder, updateOrderStatus, getOrderById, generateOrderId, generateStatusToken, verifyStatusToken } from '../lib/payments/repository';
import { STATUS_LABELS } from '../lib/payments/types';
import type { InternalPaymentStatus } from '../lib/payments/types';
import { isPaymentAmountSufficient, normalizeDecimalString } from '../lib/payments/money';

export const paymentsRouter = new Hono<{ Bindings: Env; Variables: HonoVariables & CustomerHonoVariables }>();

paymentsRouter.use('/checkout', customerAuthMiddleware);

// ─── Rate Limiting ────────────────────────────────────────────────────────────

paymentsRouter.use('/currencies', rateLimiter(60, 60 * 1000, 'rl:pay:currencies'));
paymentsRouter.use('/checkout', rateLimiter(10, 60 * 1000, 'rl:pay:checkout'));
paymentsRouter.use('/orders/*', rateLimiter(60, 60 * 1000, 'rl:pay:orders'));

// ─── GET /currencies ──────────────────────────────────────────────────────────

paymentsRouter.get('/currencies', async (c) => {
    if (!c.env.NOWPAYMENTS_API_KEY) {
        console.error(JSON.stringify({
            event: 'payments_currencies_error',
            category: 'MISSING_CONFIGURATION',
            statusCode: 503,
            message: 'NOWPAYMENTS_API_KEY binding is not configured in Worker environment',
        }));
        return c.json({ error: 'Payment service is not configured', code: 'PAYMENT_NOT_CONFIGURED' }, 503);
    }

    const cacheKey = 'nowpayments:currencies:v2';
    try {
        const cached = await c.env.CONTENT_KV.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                c.header('Cache-Control', CACHE_CONTROL.PUBLIC_CONTENT);
                return c.json({ data: parsed });
            }
        }
    } catch {
        // Fall through to live upstream fetch if KV read fails
    }

    let providerCurrencies: string[];
    try {
        providerCurrencies = await getCurrencies(c.env);
    } catch (err) {
        const isNpError = err instanceof NowPaymentsError;
        const category = isNpError ? err.category : 'NETWORK_FAILURE';
        const statusCode = isNpError ? err.statusCode : 502;
        const code = isNpError ? err.code : undefined;
        const requestId = isNpError ? err.requestId : undefined;

        console.error(JSON.stringify({
            event: 'payments_currencies_error',
            category,
            upstreamStatus: statusCode,
            code,
            requestId,
            message: err instanceof Error ? err.message : 'Payment gateway communication failure',
        }));

        const status = statusCode === 401 || statusCode === 403 || statusCode === 503 ? 503 : 502;
        return c.json({
            error: 'Unable to load payment currencies. Please try again later.',
            code: 'CURRENCIES_UNAVAILABLE',
        }, status);
    }

    if (!providerCurrencies || providerCurrencies.length === 0) {
        console.error(JSON.stringify({
            event: 'payments_currencies_error',
            category: 'MALFORMED_RESPONSE',
            upstreamStatus: 502,
            message: 'Empty currency list returned by payment gateway',
        }));
        return c.json({
            error: 'Unable to load payment currencies. Please try again later.',
            code: 'CURRENCIES_UNAVAILABLE',
        }, 502);
    }

    // Intersect provider currencies with central DreamWebApp allowlist and format display metadata
    const filteredCurrencies = filterAndOrderApprovedCurrencies(providerCurrencies);

    try {
        await c.env.CONTENT_KV.put(cacheKey, JSON.stringify(filteredCurrencies), { expirationTtl: 600 });
        await c.env.CONTENT_KV.put('nowpayments:currencies:provider:v2', JSON.stringify(providerCurrencies), { expirationTtl: 600 });
    } catch (kvErr) {
        console.warn('[payments/currencies] Failed to cache in KV:', kvErr instanceof Error ? kvErr.message : 'KV error');
    }

    c.header('Cache-Control', CACHE_CONTROL.PUBLIC_CONTENT);
    return c.json({ data: filteredCurrencies });
});

// ─── POST /checkout ───────────────────────────────────────────────────────────

paymentsRouter.post('/checkout', async (c) => {
    if (!c.env.NOWPAYMENTS_API_KEY) {
        return c.json({ error: 'Payment service is not configured', code: 'PAYMENT_NOT_CONFIGURED' }, 503);
    }

    let rawBody: unknown;
    try {
        rawBody = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = CheckoutRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
        return c.json({ error: 'Validation failed', fields: parsed.error.flatten().fieldErrors }, 422);
    }

    const { planKey, payCurrency } = parsed.data;
    const db = createDB(c.env.DB);

    // 1. Resolve authoritative price & configuration from server catalog (never client)
    const priceCurrency = (c.env.PAYMENT_PRICE_CURRENCY ?? 'usd').toLowerCase();
    const planPrice = await getPlanPrice(db, planKey, priceCurrency);
    if (!planPrice) {
        return c.json({ error: 'Plan not found or unavailable for crypto checkout', code: 'PLAN_NOT_FOUND' }, 404);
    }

    // 2. Enforce central cryptocurrency allowlist before contacting provider
    if (!isApprovedCurrency(payCurrency)) {
        return c.json({
            error: `Cryptocurrency '${payCurrency.toUpperCase()}' is not supported for checkout`,
            code: 'UNSUPPORTED_CURRENCY',
        }, 422);
    }

    // 3. Verify that the requested currency is currently available from the provider
    let availableProviderCurrencies: string[] | null = null;
    try {
        const cachedRaw = await c.env.CONTENT_KV.get('nowpayments:currencies:provider:v2');
        if (cachedRaw) {
            const parsedCodes = JSON.parse(cachedRaw);
            if (Array.isArray(parsedCodes) && parsedCodes.length > 0) {
                availableProviderCurrencies = parsedCodes;
            }
        }
    } catch {
        // Fall back to live provider check
    }

    if (!availableProviderCurrencies) {
        try {
            availableProviderCurrencies = await getCurrencies(c.env);
            try {
                await c.env.CONTENT_KV.put('nowpayments:currencies:provider:v2', JSON.stringify(availableProviderCurrencies), { expirationTtl: 600 });
                const filtered = filterAndOrderApprovedCurrencies(availableProviderCurrencies);
                await c.env.CONTENT_KV.put('nowpayments:currencies:v2', JSON.stringify(filtered), { expirationTtl: 600 });
            } catch {
                // KV write failure is non-fatal
            }
        } catch (err) {
            console.error('[payments/checkout] Provider currency check failed:', err instanceof NowPaymentsError ? err.message : 'error');
            return c.json({
                error: 'Unable to validate payment currency with gateway. Please try again.',
                code: 'GATEWAY_ERROR',
            }, 502);
        }
    }

    const isAvailableOnProvider = availableProviderCurrencies.some(
        (code) => code.trim().toLowerCase() === payCurrency.toLowerCase(),
    );

    if (!isAvailableOnProvider) {
        return c.json({
            error: `The selected cryptocurrency (${payCurrency.toUpperCase()}) is currently unavailable with the payment gateway. Please choose another currency.`,
            code: 'CURRENCY_UNAVAILABLE',
        }, 422);
    }

    // 4. Validate minimum required payment amount
    let minAmount: number;
    try {
        minAmount = await getMinimumPaymentAmount(c.env, payCurrency, priceCurrency);
    } catch (err) {
        console.error('[payments/checkout] min-amount check failed:', err instanceof NowPaymentsError ? err.message : 'error');
        return c.json({ error: 'Unable to validate payment amount with gateway. Please try again.', code: 'GATEWAY_ERROR' }, 502);
    }

    if (!isPaymentAmountSufficient(planPrice.priceAmountDecimal, minAmount, 0)) {
        return c.json({
            error: `Plan price ($${planPrice.priceAmountDecimal} ${priceCurrency.toUpperCase()}) is below the minimum required for ${payCurrency.toUpperCase()} ($${minAmount} ${priceCurrency.toUpperCase()}).`,
            code: 'BELOW_MINIMUM_AMOUNT',
            minAmount,
        }, 422);
    }

    // 5. Generate cryptographic order ID and random token
    const orderId = generateOrderId();
    const { rawToken, tokenHash } = await generateStatusToken();

    let invoiceUrl: string;
    let invoiceId: string;
    let paymentId: string | undefined;
    let payAmount: string | undefined;

    try {
        const result = await createInvoice(c.env, {
            orderId,
            priceAmount: planPrice.priceAmountDecimal,
            priceCurrency: planPrice.priceCurrency,
            payCurrency,
            outcomeCurrency: c.env.PAYMENT_OUTCOME_CURRENCY || undefined,
            ipnCallbackUrl: c.env.PAYMENT_IPN_CALLBACK_URL || undefined,
            successUrl: c.env.PAYMENT_SUCCESS_URL
                ? `${c.env.PAYMENT_SUCCESS_URL}?order_id=${orderId}&token=${rawToken}`
                : undefined,
            cancelUrl: c.env.PAYMENT_CANCEL_URL
                ? `${c.env.PAYMENT_CANCEL_URL}?order_id=${orderId}&token=${rawToken}&cancelled=1`
                : undefined,
            orderDescription: planPrice.description,
        });
        invoiceUrl = result.invoiceUrl;
        invoiceId = result.invoiceId;
        paymentId = result.paymentId;
        payAmount = result.payAmount;
    } catch (err) {
        console.error('[payments/checkout] invoice creation failed:', err instanceof NowPaymentsError ? err.message : 'error');
        const code = err instanceof NowPaymentsError ? err.code ?? 'INVOICE_CREATION_FAILED' : 'INVOICE_CREATION_FAILED';
        return c.json({ error: 'Unable to create payment invoice with gateway. Please try again.', code }, 502);
    }

    // 6. Extract authenticated customer (guaranteed by customerAuthMiddleware)
    const customer = c.get('customer')!;
    const userId = customer.userId;

    // 7. Persist order in D1
    try {
        await createOrder(db, {
            orderId,
            statusTokenHash: tokenHash,
            userId,
            planKey,
            billingMode: planPrice.billingMode,
            expectedPriceAmountDecimal: planPrice.priceAmountDecimal,
            priceCurrency: planPrice.priceCurrency,
            payCurrency,
            expectedPayAmountDecimal: payAmount != null ? normalizeDecimalString(payAmount, 8) : null,
            providerInvoiceId: invoiceId,
            providerPaymentId: paymentId ?? null,
        });

        if (paymentId) {
            await updateOrderStatus(db, orderId, {
                internalStatus: 'waiting',
                providerPaymentId: paymentId,
                providerStatus: 'waiting',
            });
        }
    } catch (err) {
        console.error('[payments/checkout] D1 persist failed:', err instanceof Error ? err.message : 'error');
    }

    c.header('Cache-Control', CACHE_CONTROL.NO_STORE);
    return c.json({
        orderId,
        statusToken: rawToken,
        invoiceUrl,
    }, 201);
});

// ─── GET /orders/:orderId ─────────────────────────────────────────────────────

paymentsRouter.get('/orders/:orderId', async (c) => {
    const orderId = c.req.param('orderId');

    const queryParsed = OrderStatusQuerySchema.safeParse(c.req.query());
    const statusToken = queryParsed.success ? (queryParsed.data.token ?? null) : null;

    const db = createDB(c.env.DB);
    const order = await getOrderById(db, orderId);

    if (!order) {
        return c.json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' }, 404);
    }

    // Strict Authorization: status token hash verification or user ownership
    let isAuthorized = false;

    if (statusToken) {
        isAuthorized = await verifyStatusToken(order, statusToken);
    } else {
        const jwt = c.get('jwtPayload') as unknown as { sub?: string } | undefined;
        if (jwt && order.userId && jwt.sub === order.userId) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        return c.json({ error: 'Access denied: valid status token required', code: 'UNAUTHORIZED' }, 403);
    }

    const internalStatus = order.internalStatus as InternalPaymentStatus;

    c.header('Cache-Control', CACHE_CONTROL.NO_STORE);
    return c.json({
        orderId: order.orderId,
        planKey: order.planKey,
        billingMode: order.billingMode,
        status: internalStatus,
        statusLabel: STATUS_LABELS[internalStatus],
        priceAmount: order.expectedPriceAmountDecimal,
        priceCurrency: order.priceCurrency.toUpperCase(),
        payCurrency: order.payCurrency.toUpperCase(),
        payAmount: order.expectedPayAmountDecimal ?? null,
        isPaid: internalStatus === 'paid',
        isTerminal: ['paid', 'failed', 'expired', 'refunded'].includes(internalStatus),
        updatedAt: order.updatedAt,
        entitlementGrantedAt: order.entitlementGrantedAt ?? null,
    });
});
