/**
 * Webhook routes — mounted at /api/v1/webhooks
 *
 *   POST /nowpayments  -> NOWPayments IPN handler
 *
 * Security & Reliability Contract:
 *   1. Request body read once as raw text before parsing.
 *   2. HMAC-SHA512 with NOWPAYMENTS_IPN_SECRET verified using timing-safe byte comparison.
 *   3. Missing or invalid signature rejected with 401.
 *   4. Stable event fingerprint recorded with DB-level UNIQUE constraint for idempotency.
 *   5. Currency and monetary amounts verified before status transition.
 *   6. Status transitions strictly follow whitelist; terminal paid status is never downgraded.
 *   7. Zero secrets logged or returned.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { HonoVariables } from '../middleware/auth';
import { createDB } from '../db';
import * as schema from '../db/schema';
import { verifyIpnSignature, sha256Hex } from '../lib/payments/webhook';
import { WebhookPayloadSchema } from '../validators/schemas';
import { getOrderById, getOrderByProviderPaymentId, updateOrderStatus, recordEvent } from '../lib/payments/repository';
import { mapProviderStatus } from '../lib/payments/types';
import { isCurrencyMatch, isPaymentAmountSufficient } from '../lib/payments/money';
import { SERVER_CRYPTO_CATALOG } from '../lib/payments/catalog';

export const webhooksRouter = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// ─── POST /nowpayments ────────────────────────────────────────────────────────

webhooksRouter.post('/nowpayments', async (c) => {
    // ── 1. Guard: IPN secret must be configured ───────────────────────────────
    if (!c.env.NOWPAYMENTS_IPN_SECRET) {
        console.error('[webhook/nowpayments] IPN secret is not configured in Worker environment');
        return c.json({ error: 'Webhook processing unavailable' }, 503);
    }

    // ── 2. Read raw body once ─────────────────────────────────────────────────
    let rawBody: string;
    try {
        rawBody = await c.req.text();
    } catch {
        return c.json({ error: 'Failed to read request body' }, 400);
    }

    // ── 3. Verify HMAC-SHA512 signature ───────────────────────────────────────
    const signature = c.req.header('x-nowpayments-sig');
    if (!signature) {
        console.warn('[webhook/nowpayments] Missing x-nowpayments-sig header');
        return c.json({ error: 'Missing signature' }, 401);
    }

    const isValid = await verifyIpnSignature(rawBody, signature, c.env.NOWPAYMENTS_IPN_SECRET);
    if (!isValid) {
        console.warn('[webhook/nowpayments] Invalid IPN signature');
        return c.json({ error: 'Invalid signature' }, 401);
    }

    // ── 4. Parse JSON safely ──────────────────────────────────────────────────
    let parsed: unknown;
    try {
        parsed = JSON.parse(rawBody);
    } catch {
        return c.json({ error: 'Invalid JSON payload' }, 400);
    }

    const validated = WebhookPayloadSchema.safeParse(parsed);
    if (!validated.success) {
        console.warn('[webhook/nowpayments] Payload schema validation failed');
        return c.json({ error: 'Invalid payload structure', fields: validated.error.flatten().fieldErrors }, 422);
    }

    const payload = validated.data;
    const { payment_id: providerPaymentId, order_id: orderId, payment_status: providerStatus } = payload;

    // ── 5. Fingerprint & Payload Hash ─────────────────────────────────────────
    const eventFingerprint = await sha256Hex(`${orderId}:${providerPaymentId}:${providerStatus}`);
    const payloadHash = await sha256Hex(rawBody);

    const db = createDB(c.env.DB);

    // ── 6. Idempotency Check via Database-level UNIQUE Constraint ─────────────
    const isNew = await recordEvent(db, {
        orderId,
        providerPaymentId,
        providerStatus,
        eventFingerprint,
        payloadHash,
    });

    if (!isNew) {
        // Duplicate delivery already processed
        return c.json({ received: true, duplicate: true }, 200);
    }

    // ── 7. Order Lookup ───────────────────────────────────────────────────────
    let order = await getOrderById(db, orderId);
    if (!order) {
        order = await getOrderByProviderPaymentId(db, providerPaymentId);
    }

    if (!order) {
        console.warn('[webhook/nowpayments] Order not found for webhook notification');
        return c.json({ received: true, ignored: true, reason: 'order_not_found' }, 200);
    }

    // ── 8. Money & Currency Validation Policy ─────────────────────────────────
    // Check if currencies match (if provided in the IPN)
    if (payload.price_currency && !isCurrencyMatch(payload.price_currency, order.priceCurrency)) {
        console.warn(`[webhook/nowpayments] Price currency mismatch: expected ${order.priceCurrency}, got ${payload.price_currency}`);
        try {
            await updateOrderStatus(db, order.orderId, {
                providerPaymentId,
                providerStatus,
                internalStatus: 'failed',
            });
        } catch { /* ignore transition errors */ }
        return c.json({ received: true, ignored: true, reason: 'currency_mismatch' }, 200);
    }

    // Determine mapped internal status
    let newInternalStatus = mapProviderStatus(providerStatus);

    // If marked finished/paid, verify that the price or pay amount is sufficient
    if (newInternalStatus === 'paid') {
        const receivedPriceAmount = payload.price_amount ?? payload.actually_paid;
        if (receivedPriceAmount !== undefined) {
            // Tolerates 0% underpayment (exact or greater)
            const isSufficient = isPaymentAmountSufficient(receivedPriceAmount, order.expectedPriceAmountDecimal, 0.0);
            if (!isSufficient) {
                console.warn(`[webhook/nowpayments] Received underpayment: ${receivedPriceAmount} vs expected ${order.expectedPriceAmountDecimal}`);
                newInternalStatus = 'partially_paid';
            }
        }
    }

    // ── 9. Apply Validated Status Transition ──────────────────────────────────
    try {
        await updateOrderStatus(db, order.orderId, {
            providerPaymentId,
            providerStatus,
            internalStatus: newInternalStatus,
        });

        // ── 10. Idempotently Grant Customer Service Entitlement ───────────────
        if (newInternalStatus === 'paid' && order.userId) {
            try {
                const catalogItem = SERVER_CRYPTO_CATALOG[order.planKey];
                const serviceName = catalogItem?.planName || order.planKey.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
                const serviceId = `srv_${crypto.randomUUID()}`;
                const now = new Date().toISOString();

                await db.insert(schema.customerServices).values({
                    id: serviceId,
                    userId: order.userId,
                    orderId: order.orderId,
                    planKey: order.planKey,
                    serviceName,
                    status: 'active',
                    startedAt: now,
                    createdAt: now,
                    updatedAt: now,
                });
            } catch (svcErr) {
                // If service already exists for this orderId (UNIQUE constraint), ignore duplicate insert
                const msg = svcErr instanceof Error ? svcErr.message : String(svcErr);
                if (!msg.includes('UNIQUE') && !msg.includes('unique')) {
                    console.warn('[webhook/nowpayments] Entitlement creation warning:', msg);
                }
            }
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'transition_error';
        console.warn('[webhook/nowpayments] Status transition skipped:', msg);
        return c.json({ received: true, ignored: true, reason: msg }, 200);
    }

    return c.json({ received: true }, 200);
});
