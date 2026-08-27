/**
 * Typed HTTP client for the NOWPayments REST API v1.
 *
 * All calls are strictly server-side — the API key never leaves the Worker.
 * Uses a Cloudflare Worker compatible AbortController timeout helper.
 * Redacts secrets from errors and logs, and provides robust response parsing.
 */

import type { Env } from '../../types/env';

const DEFAULT_BASE_URL = 'https://api.nowpayments.io/v1';
const REQUEST_TIMEOUT_MS = 15_000;

// ─── Error Categories ─────────────────────────────────────────────────────────

export type NowPaymentsErrorCategory =
    | 'MISSING_CONFIGURATION'
    | 'TIMEOUT_FAILURE'
    | 'NETWORK_FAILURE'
    | 'UPSTREAM_AUTH_FAILURE'
    | 'UPSTREAM_RATE_LIMITED'
    | 'UPSTREAM_ERROR'
    | 'MALFORMED_RESPONSE';

export class NowPaymentsError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string,
        public readonly category: NowPaymentsErrorCategory,
        public readonly code?: string,
        public readonly requestId?: string,
    ) {
        super(message);
        this.name = 'NowPaymentsError';
    }
}

// ─── Response shapes ───────────────────────────────────────────────────────────

interface NowPaymentsMinAmountResponse {
    currency_from: string;
    currency_to: string;
    min_amount: number;
    fiat_equivalent: number | null;
}

interface NowPaymentsEstimateResponse {
    currency_from: string;
    amount_from: number;
    currency_to: string;
    estimated_amount: number;
}

export interface NowPaymentsInvoiceResponse {
    id: string | number;
    order_id: string;
    order_description?: string;
    price_amount: number | string;
    price_currency: string;
    pay_currency?: string;
    pay_amount?: number | string | null;
    invoice_url: string;
    payment_id?: string | number | null;
    created_at?: string;
    updated_at?: string;
}

// ─── Core fetch helper with AbortController ────────────────────────────────────

async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
    const controller = new AbortController();
    const timerId = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        const res = await fetch(url, {
            ...init,
            signal: controller.signal,
        });
        return res;
    } catch (err: unknown) {
        if (
            (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError') ||
            controller.signal.aborted
        ) {
            throw new NowPaymentsError(504, 'Payment gateway request timed out', 'TIMEOUT_FAILURE');
        }
        throw new NowPaymentsError(
            502,
            `Payment gateway unreachable: ${err instanceof Error ? err.message : 'network failure'}`,
            'NETWORK_FAILURE',
        );
    } finally {
        clearTimeout(timerId);
    }
}

async function npFetch<T>(
    env: Pick<Env, 'NOWPAYMENTS_API_KEY' | 'NOWPAYMENTS_API_BASE_URL'>,
    path: string,
    init?: RequestInit,
): Promise<T> {
    if (!env.NOWPAYMENTS_API_KEY) {
        throw new NowPaymentsError(503, 'Payment service is not configured', 'MISSING_CONFIGURATION');
    }
    const base = (env.NOWPAYMENTS_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    const url = `${base}${path}`;

    const res = await fetchWithTimeout(url, {
        ...init,
        headers: {
            'x-api-key': env.NOWPAYMENTS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...init?.headers,
        },
    });

    const requestId =
        res.headers.get('x-request-id') ??
        res.headers.get('cf-ray') ??
        res.headers.get('traceparent') ??
        undefined;

    let body: unknown;
    try {
        body = await res.json();
    } catch {
        throw new NowPaymentsError(
            res.status,
            `Unexpected response format from payment gateway (status ${res.status})`,
            'MALFORMED_RESPONSE',
            undefined,
            requestId,
        );
    }

    if (!res.ok) {
        let category: NowPaymentsErrorCategory = 'UPSTREAM_ERROR';
        if (res.status === 401 || res.status === 403) {
            category = 'UPSTREAM_AUTH_FAILURE';
        } else if (res.status === 429) {
            category = 'UPSTREAM_RATE_LIMITED';
        }

        const msg =
            typeof body === 'object' && body !== null && 'message' in body
                ? String((body as Record<string, unknown>)['message']).slice(0, 200)
                : `NOWPayments request failed with status ${res.status}`;
        const code =
            typeof body === 'object' && body !== null && 'code' in body
                ? String((body as Record<string, unknown>)['code']).slice(0, 50)
                : undefined;

        throw new NowPaymentsError(res.status, msg, category, code, requestId);
    }

    return body as T;
}

// ─── Currency extractor helper ────────────────────────────────────────────────

/**
 * Extracts, validates, normalizes, deduplicates, and sorts currency codes from any valid NOWPayments payload.
 */
export function extractAndNormalizeCurrencies(data: unknown): string[] {
    let rawList: unknown[] = [];

    if (Array.isArray(data)) {
        rawList = data;
    } else if (typeof data === 'object' && data !== null) {
        const record = data as Record<string, unknown>;
        if (Array.isArray(record['currencies'])) {
            rawList = record['currencies'];
        } else if (Array.isArray(record['selectedCurrencies'])) {
            rawList = record['selectedCurrencies'];
        } else if (Array.isArray(record['data'])) {
            rawList = record['data'];
        }
    }

    const codeSet = new Set<string>();
    for (const item of rawList) {
        if (typeof item === 'string') {
            const clean = item.trim().toLowerCase();
            if (clean.length >= 2 && clean.length <= 30 && /^[a-z0-9_]+$/.test(clean)) {
                codeSet.add(clean);
            }
        } else if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>;
            const rawCode = obj['code'] ?? obj['currency'] ?? obj['ticker'] ?? obj['id'];
            if (typeof rawCode === 'string') {
                const clean = rawCode.trim().toLowerCase();
                if (clean.length >= 2 && clean.length <= 30 && /^[a-z0-9_]+$/.test(clean)) {
                    codeSet.add(clean);
                }
            }
        }
    }

    return Array.from(codeSet).sort();
}

// ─── Public API calls ─────────────────────────────────────────────────────────

/**
 * Returns the list of currency codes available for payment on this NOWPayments account.
 * Supports plain string arrays, `{ currencies: string[] }`, and object lists.
 */
export async function getCurrencies(
    env: Pick<Env, 'NOWPAYMENTS_API_KEY' | 'NOWPAYMENTS_API_BASE_URL'>,
): Promise<string[]> {
    const data = await npFetch<unknown>(env, '/currencies');
    const currencies = extractAndNormalizeCurrencies(data);

    if (currencies.length === 0) {
        throw new NowPaymentsError(
            502,
            'Malformed or empty currencies response from payment gateway',
            'MALFORMED_RESPONSE',
        );
    }

    return currencies;
}

/**
 * Fetches the minimum payment amount for a given pay/price currency pair.
 */
export async function getMinimumPaymentAmount(
    env: Pick<Env, 'NOWPAYMENTS_API_KEY' | 'NOWPAYMENTS_API_BASE_URL'>,
    payCurrency: string,
    priceCurrency: string,
): Promise<number> {
    const data = await npFetch<NowPaymentsMinAmountResponse>(
        env,
        `/min-amount?currency_from=${encodeURIComponent(payCurrency)}&currency_to=${encodeURIComponent(priceCurrency)}`,
    );
    return data.min_amount;
}

/**
 * Returns an estimated crypto amount for the given fiat amount.
 */
export async function getEstimatedPrice(
    env: Pick<Env, 'NOWPAYMENTS_API_KEY' | 'NOWPAYMENTS_API_BASE_URL'>,
    amount: number,
    fromCurrency: string,
    toCurrency: string,
): Promise<number> {
    const data = await npFetch<NowPaymentsEstimateResponse>(
        env,
        `/estimate?amount=${amount}&currency_from=${encodeURIComponent(fromCurrency)}&currency_to=${encodeURIComponent(toCurrency)}`,
    );
    return data.estimated_amount;
}

export interface CreateInvoiceParams {
    orderId: string;
    priceAmount: string | number;
    priceCurrency: string;
    payCurrency: string;
    outcomeCurrency?: string;
    ipnCallbackUrl?: string;
    successUrl?: string;
    cancelUrl?: string;
    orderDescription?: string;
}

/**
 * Creates a hosted payment invoice on NOWPayments.
 * Safely parses the invoice URL, provider invoice ID, and optional payment ID.
 */
export async function createInvoice(
    env: Pick<Env, 'NOWPAYMENTS_API_KEY' | 'NOWPAYMENTS_API_BASE_URL'>,
    params: CreateInvoiceParams,
): Promise<{ invoiceUrl: string; invoiceId: string; paymentId?: string; payAmount?: string }> {
    const body: Record<string, unknown> = {
        price_amount: params.priceAmount,
        price_currency: params.priceCurrency,
        pay_currency: params.payCurrency,
        order_id: params.orderId,
        order_description: params.orderDescription ?? `Order ${params.orderId}`,
    };

    if (params.outcomeCurrency) {
        body['outcome_currency'] = params.outcomeCurrency;
    }
    if (params.ipnCallbackUrl) {
        body['ipn_callback_url'] = params.ipnCallbackUrl;
    }
    if (params.successUrl) {
        body['success_url'] = params.successUrl;
    }
    if (params.cancelUrl) {
        body['cancel_url'] = params.cancelUrl;
    }

    const data = await npFetch<NowPaymentsInvoiceResponse>(env, '/invoice', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    if (!data.invoice_url) {
        throw new NowPaymentsError(502, 'NOWPayments did not return an invoice URL', 'MALFORMED_RESPONSE');
    }

    const invoiceId = String(data.id);
    const paymentId = data.payment_id != null ? String(data.payment_id) : undefined;
    const payAmount = data.pay_amount != null ? String(data.pay_amount) : undefined;

    return {
        invoiceUrl: data.invoice_url,
        invoiceId,
        paymentId,
        payAmount,
    };
}
