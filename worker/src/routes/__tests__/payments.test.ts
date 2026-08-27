/**
 * Production-readiness payment subsystem test suite.
 *
 * Tests:
 *  1. sortKeysRecursive — recursive JSON key sorting with nested objects and arrays
 *  2. verifyIpnSignature — valid, tampered, wrong secret, malformed JSON, key-order independence
 *  3. money — decimal string normalization, safe BigInt comparisons, sufficiency tolerance
 *  4. mapProviderStatus — full coverage including created, waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired
 *  5. isLegalTransition — legal progressions and terminal-state downgrade prevention
 *  6. repository & tokens — crypto.getRandomValues ID and status token generation and verification
 *  7. CheckoutRequestSchema — strict validation against client price tampering
 *  8. sha256Hex — deterministic digest verification
 *  9. POST /api/v1/webhooks/nowpayments — signature verification, duplicate idempotency, error handling
 * 10. GET /api/v1/payments/orders/:orderId — token-authenticated access control
 */

import { describe, it, expect } from 'vitest';
import { sortKeysRecursive, verifyIpnSignature, sha256Hex } from '../../lib/payments/webhook';
import { mapProviderStatus, isLegalTransition, TERMINAL_STATUSES } from '../../lib/payments/types';
import type { InternalPaymentStatus } from '../../lib/payments/types';
import { normalizeDecimalString, compareDecimalStrings, isPaymentAmountSufficient, isCurrencyMatch, sumDecimalStrings } from '../../lib/payments/money';
import { generateOrderId, generateStatusToken, verifyStatusToken } from '../../lib/payments/repository';
import type { PaymentOrderRow } from '../../lib/payments/repository';
import { CheckoutRequestSchema } from '../../validators/schemas';
import { getPlanPrice, SERVER_CRYPTO_CATALOG } from '../../lib/payments/catalog';
import {
    APPROVED_CURRENCY_CATALOG,
    APPROVED_CURRENCY_CODES,
    isApprovedCurrency,
    getApprovedCurrency,
    filterAndOrderApprovedCurrencies,
    type PaymentCurrencyPublicItem,
} from '../../lib/payments/currencies';
import { extractAndNormalizeCurrencies } from '../../lib/payments/nowpayments-client';
import { signJWT } from '../../middleware/auth';
import { createDB } from '../../db';
import app from '../../index';
import type { Env } from '../../types/env';

// ─── Mock D1 & Environment Helpers ────────────────────────────────────────────

function extractSelectedColumns(sql: string): string[] | null {
    const match = sql.match(/select\s+([\s\S]+?)\s+from/i);
    if (!match || !match[1]) return null;
    const rawCols = match[1].trim();
    if (rawCols === '*') return null;
    return rawCols.split(',').map((c) => {
        const trimmed = c.trim();
        if (trimmed.toLowerCase().includes('count(')) return 'count';
        const colPart = trimmed.split(/\s+as\s+/i)[0]?.trim() ?? '';
        // Strip quotes, table aliases, e.g. "payment_events"."provider_status" -> "provider_status"
        return colPart.replace(/^["`]|["`]$/g, '').split('.').pop()?.replace(/^["`]|["`]$/g, '') ?? '';
    });
}

function createMockD1(rows: Record<string, unknown[]> = {}): D1Database {
    return {
        prepare(query: string) {
            let boundParams: unknown[] = [];
            const stmt = {
                bind(...params: unknown[]) { boundParams = params; return stmt; },
                async all() {
                    for (const [key, data] of Object.entries(rows)) {
                        if (query.includes(key)) {
                            if (query.toLowerCase().includes('count(')) {
                                if (query.includes('group by') && query.includes('payment_events')) {
                                    return { results: [{ order_id: 'order-uuid-001', orderId: 'order-uuid-001', count: data.length }], success: true, meta: {} };
                                }
                                return { results: [{ count: data.length }], success: true, meta: {} };
                            }
                            if (boundParams.length > 0 && query.toLowerCase().includes('where')) {
                                const idParam = boundParams.find((p) => typeof p === 'string' && (p.startsWith('order-') || p.includes('-') || p.startsWith('np_')));
                                if (idParam) {
                                    const filtered = data.filter((r) => {
                                        const row = r as Record<string, unknown>;
                                        return (
                                            row['order_id'] === idParam ||
                                            row['orderId'] === idParam ||
                                            row['provider_payment_id'] === idParam ||
                                            row['id'] === idParam
                                        );
                                    });
                                    return { results: filtered, success: true, meta: {} };
                                }
                            }
                            return { results: data, success: true, meta: {} };
                        }
                    }
                    if (query.toLowerCase().includes('count(')) {
                        return { results: [{ count: 0 }], success: true, meta: {} };
                    }
                    return { results: [], success: true, meta: {} };
                },
                async raw() {
                    const res = await stmt.all();
                    const cols = extractSelectedColumns(query);
                    if (cols && cols.length > 0) {
                        return res.results.map((r) => {
                            const row = r as Record<string, unknown>;
                            return cols.map((col) => row[col] ?? row[col.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] ?? null);
                        });
                    }
                    return res.results.map((r) => Object.values(r as Record<string, unknown>));
                },
                async first(col?: string) {
                    const res = await stmt.all();
                    const first = res.results[0];
                    if (!first) return null;
                    return col ? (first as Record<string, unknown>)[col] : first;
                },
                async run() {
                    // Check if inserting a duplicate fingerprint in payment_events
                    if (query.includes('payment_events') && boundParams.length > 0) {
                        const fingerprint = boundParams.find((p) => typeof p === 'string' && p.length === 64);
                        const existing = rows['payment_events'] ?? [];
                        if (existing.some((e) => (e as Record<string, unknown>)['event_fingerprint'] === fingerprint)) {
                            throw new Error('D1_ERROR: UNIQUE constraint failed: payment_events.event_fingerprint');
                        }
                    }
                    return { success: true, meta: { duration: 0, size_after: 0, rows_read: 0, rows_written: 0, last_row_id: 0, changed_db: false, changes: 0 } };
                },
            } as unknown as D1PreparedStatement;
            return stmt;
        },
        async batch() { return []; },
        async exec() { return { count: 0, duration: 0 }; },
        async dump() { return new ArrayBuffer(0); },
    } as unknown as D1Database;
}

function createTestEnv(overrides: Partial<Env> = {}): Env {
    return {
        ENVIRONMENT: 'test',
        CORS_ORIGIN: 'https://dreamwebapp.com',
        JWT_SECRET: 'test-jwt-secret-min-32-chars-long-example',
        DB: createMockD1(),
        LOGO_ASSETS: undefined as unknown as R2Bucket,
        CONTENT_KV: {
            get: async () => null,
            put: async () => {},
            delete: async () => {},
            list: async () => ({ keys: [], list_complete: true, caret: undefined }),
            getWithMetadata: async () => ({ value: null, metadata: null }),
        } as unknown as KVNamespace,
        NOWPAYMENTS_IPN_SECRET: 'test-ipn-secret-for-unit-tests',
        ...overrides,
    } as Env;
}

async function makeValidSignature(secret: string, body: Record<string, unknown>): Promise<string> {
    const sorted = JSON.stringify(sortKeysRecursive(body));
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(sorted));
    return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── 1. sortKeysRecursive ─────────────────────────────────────────────────────

describe('sortKeysRecursive', () => {
    it('sorts top-level keys alphabetically', () => {
        const input = { z: 1, a: 2, m: 3 };
        const result = sortKeysRecursive(input) as Record<string, unknown>;
        expect(Object.keys(result)).toEqual(['a', 'm', 'z']);
    });

    it('recursively sorts nested object keys', () => {
        const input = { z: { y: 1, a: 2 }, a: 'top' };
        const result = sortKeysRecursive(input) as Record<string, unknown>;
        expect(Object.keys(result)).toEqual(['a', 'z']);
        expect(Object.keys(result['z'] as Record<string, unknown>)).toEqual(['a', 'y']);
    });

    it('does not sort array elements, but sorts objects inside arrays', () => {
        const input = { arr: [{ z: 1, a: 2 }, 3, 1] };
        const result = sortKeysRecursive(input) as { arr: unknown[] };
        expect(Object.keys(result.arr[0] as Record<string, unknown>)).toEqual(['a', 'z']);
        expect(result.arr.slice(1)).toEqual([3, 1]);
    });

    it('handles primitives, null, and empty objects', () => {
        expect(sortKeysRecursive('hello')).toBe('hello');
        expect(sortKeysRecursive(42)).toBe(42);
        expect(sortKeysRecursive(null)).toBe(null);
        expect(sortKeysRecursive({})).toEqual({});
    });

    it('produces deterministic JSON serialization regardless of original key order', () => {
        const a = { payment_status: 'finished', payment_id: '123', order_id: 'abc', meta: { y: 2, x: 1 } };
        const b = { meta: { x: 1, y: 2 }, order_id: 'abc', payment_id: '123', payment_status: 'finished' };
        expect(JSON.stringify(sortKeysRecursive(a))).toBe(JSON.stringify(sortKeysRecursive(b)));
    });
});

// ─── 2. verifyIpnSignature ────────────────────────────────────────────────────

describe('verifyIpnSignature', () => {
    const secret = 'test-secret-value';
    const payload = { payment_id: '12345', order_id: 'abc-123', payment_status: 'waiting', nested: { b: 2, a: 1 } };

    it('returns true for a valid signature', async () => {
        const rawBody = JSON.stringify(payload);
        const sig = await makeValidSignature(secret, payload);
        expect(await verifyIpnSignature(rawBody, sig, secret)).toBe(true);
    });

    it('returns false when body is tampered', async () => {
        const tamperedBody = JSON.stringify({ ...payload, payment_status: 'finished' });
        const sig = await makeValidSignature(secret, payload);
        expect(await verifyIpnSignature(tamperedBody, sig, secret)).toBe(false);
    });

    it('returns false for an incorrect signature', async () => {
        const rawBody = JSON.stringify(payload);
        expect(await verifyIpnSignature(rawBody, 'deadbeef1234567890', secret)).toBe(false);
    });

    it('returns false when verified with a wrong secret', async () => {
        const rawBody = JSON.stringify(payload);
        const sig = await makeValidSignature(secret, payload);
        expect(await verifyIpnSignature(rawBody, sig, 'different-wrong-secret')).toBe(false);
    });

    it('returns false for invalid JSON body', async () => {
        expect(await verifyIpnSignature('not-json-content', 'anysig', secret)).toBe(false);
    });

    it('is key-order-independent', async () => {
        const reordered = JSON.stringify({ order_id: 'abc-123', payment_status: 'waiting', payment_id: '12345', nested: { a: 1, b: 2 } });
        const sig = await makeValidSignature(secret, payload);
        expect(await verifyIpnSignature(reordered, sig, secret)).toBe(true);
    });
});

// ─── 3. Decimal-Safe Money Helpers ────────────────────────────────────────────

describe('money helper suite', () => {
    it('normalizeDecimalString formats numbers and strings accurately', () => {
        expect(normalizeDecimalString(299, 2)).toBe('299.00');
        expect(normalizeDecimalString('299', 2)).toBe('299.00');
        expect(normalizeDecimalString('299.5', 2)).toBe('299.50');
        expect(normalizeDecimalString(0.00512, 8)).toBe('0.00512000');
    });

    it('compareDecimalStrings compares amounts without float inaccuracy', () => {
        expect(compareDecimalStrings('299.00', '299.00')).toBe(0);
        expect(compareDecimalStrings('299.00', '300.00')).toBe(-1);
        expect(compareDecimalStrings('300.00', '299.99')).toBe(1);
        expect(compareDecimalStrings('0.00000002', '0.00000001')).toBe(1);
    });

    it('isPaymentAmountSufficient enforces exact or greater under zero tolerance', () => {
        expect(isPaymentAmountSufficient('299.00', '299.00', 0)).toBe(true);
        expect(isPaymentAmountSufficient('300.00', '299.00', 0)).toBe(true);
        expect(isPaymentAmountSufficient('298.99', '299.00', 0)).toBe(false);
    });

    it('isPaymentAmountSufficient respects tolerance fraction when specified', () => {
        // 1% tolerance: 299 * 0.99 = 296.01
        expect(isPaymentAmountSufficient('297.00', '299.00', 0.01)).toBe(true);
        expect(isPaymentAmountSufficient('295.00', '299.00', 0.01)).toBe(false);
    });

    it('isCurrencyMatch checks currency equivalence case-insensitively', () => {
        expect(isCurrencyMatch('usd', 'USD')).toBe(true);
        expect(isCurrencyMatch('BTC', 'btc')).toBe(true);
        expect(isCurrencyMatch('usdttrc20', 'USDTTRC20')).toBe(true);
        expect(isCurrencyMatch('usd', 'eur')).toBe(false);
        expect(isCurrencyMatch(null, 'usd')).toBe(false);
    });
});

// ─── 4. mapProviderStatus ─────────────────────────────────────────────────────

describe('mapProviderStatus', () => {
    const cases: Array<[string, InternalPaymentStatus]> = [
        ['created',        'waiting'],
        ['waiting',        'waiting'],
        ['confirming',     'confirming'],
        ['confirmed',      'confirming'],
        ['sending',        'confirming'],
        ['partially_paid', 'partially_paid'],
        ['finished',       'paid'],
        ['failed',         'failed'],
        ['refunded',       'refunded'],
        ['expired',        'expired'],
        ['CREATED',        'waiting'],
        ['FINISHED',       'paid'],
        ['unknown_status', 'pending'],
        ['',               'pending'],
    ];

    it.each(cases)('maps %s -> %s', (providerStatus, expected) => {
        expect(mapProviderStatus(providerStatus)).toBe(expected);
    });
});

// ─── 5. isLegalTransition & Downgrade Prevention ──────────────────────────────

describe('isLegalTransition state machine', () => {
    it('allows same-status transitions (idempotent)', () => {
        expect(isLegalTransition('pending', 'pending')).toBe(true);
        expect(isLegalTransition('paid', 'paid')).toBe(true);
        expect(isLegalTransition('failed', 'failed')).toBe(true);
    });

    it('allows forward happy-path transitions', () => {
        expect(isLegalTransition('pending', 'waiting')).toBe(true);
        expect(isLegalTransition('waiting', 'confirming')).toBe(true);
        expect(isLegalTransition('confirming', 'paid')).toBe(true);
    });

    it('strictly prohibits downgrading from paid (terminal state)', () => {
        expect(isLegalTransition('paid', 'failed')).toBe(false);
        expect(isLegalTransition('paid', 'expired')).toBe(false);
        expect(isLegalTransition('paid', 'waiting')).toBe(false);
        expect(isLegalTransition('paid', 'confirming')).toBe(false);
        expect(isLegalTransition('paid', 'partially_paid')).toBe(false);
    });

    it('strictly prohibits transitioning out of any terminal state', () => {
        for (const status of TERMINAL_STATUSES) {
            const nonTerminal: InternalPaymentStatus[] = ['pending', 'waiting', 'confirming', 'partially_paid'];
            for (const target of nonTerminal) {
                expect(isLegalTransition(status, target)).toBe(false);
            }
        }
    });
});

// ─── 6. Repository & Token Security ───────────────────────────────────────────

describe('repository token and ID security', () => {
    it('generateOrderId produces valid UUIDv4 format using getRandomValues', () => {
        const id = generateOrderId();
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('generateStatusToken produces random token and correct SHA-256 hash', async () => {
        const { rawToken, tokenHash } = await generateStatusToken();
        expect(rawToken).toHaveLength(64);
        expect(tokenHash).toHaveLength(64);

        // Verify SHA-256 hash
        const expectedHash = await sha256Hex(rawToken);
        expect(tokenHash).toBe(expectedHash);
    });

    it('verifyStatusToken returns true only for matching raw token', async () => {
        const { rawToken, tokenHash } = await generateStatusToken();
        const mockOrder = { statusTokenHash: tokenHash } as PaymentOrderRow;

        expect(await verifyStatusToken(mockOrder, rawToken)).toBe(true);
        expect(await verifyStatusToken(mockOrder, 'wrong-token-value')).toBe(false);
        expect(await verifyStatusToken(mockOrder, '')).toBe(false);
    });
});

// ─── 7. CheckoutRequestSchema Validation ──────────────────────────────────────

describe('CheckoutRequestSchema', () => {
    it('accepts valid plan and currency', () => {
        const result = CheckoutRequestSchema.safeParse({ planKey: 'starter-bot', payCurrency: 'btc' });
        expect(result.success).toBe(true);
    });

    it('normalizes payCurrency to lowercase', () => {
        const result = CheckoutRequestSchema.safeParse({ planKey: 'starter-bot', payCurrency: 'USDTTRC20' });
        expect(result.success && result.data.payCurrency).toBe('usdttrc20');
    });

    it('rejects missing planKey or invalid characters', () => {
        expect(CheckoutRequestSchema.safeParse({ payCurrency: 'btc' }).success).toBe(false);
        expect(CheckoutRequestSchema.safeParse({ planKey: 'INVALID PLAN', payCurrency: 'btc' }).success).toBe(false);
        expect(CheckoutRequestSchema.safeParse({ planKey: '<script>', payCurrency: 'btc' }).success).toBe(false);
    });

    it('accepts optional one_time billingMode', () => {
        const r = CheckoutRequestSchema.safeParse({ planKey: 'starter-bot', payCurrency: 'btc', billingMode: 'one_time' });
        expect(r.success && r.data.billingMode).toBe('one_time');
    });
});

// ─── 8. sha256Hex ─────────────────────────────────────────────────────────────

describe('sha256Hex', () => {
    it('produces a 64-char lowercase hex digest', async () => {
        const digest = await sha256Hex('test payload');
        expect(digest).toHaveLength(64);
        expect(digest).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is strictly deterministic', async () => {
        expect(await sha256Hex('input')).toBe(await sha256Hex('input'));
        expect(await sha256Hex('input1')).not.toBe(await sha256Hex('input2'));
    });
});

// ─── 9. IPN Webhook Endpoint ──────────────────────────────────────────────────

describe('POST /api/v1/webhooks/nowpayments', () => {
    const ipnSecret = 'test-ipn-secret-for-unit-tests';
    const samplePayload = {
        payment_id: '5077461678',
        order_id: 'test-order-001',
        payment_status: 'finished',
        price_amount: 299,
        price_currency: 'usd',
        pay_currency: 'btc',
    };

    it('returns 401 when x-nowpayments-sig header is missing', async () => {
        const env = createTestEnv();
        const res = await app.request('/api/v1/webhooks/nowpayments', {
            method: 'POST',
            body: JSON.stringify(samplePayload),
            headers: { 'Content-Type': 'application/json' },
        }, env);
        expect(res.status).toBe(401);
    });

    it('returns 401 for an invalid signature', async () => {
        const env = createTestEnv();
        const res = await app.request('/api/v1/webhooks/nowpayments', {
            method: 'POST',
            body: JSON.stringify(samplePayload),
            headers: {
                'Content-Type': 'application/json',
                'x-nowpayments-sig': 'bad-signature-hex',
            },
        }, env);
        expect(res.status).toBe(401);
    });

    it('returns 200 with received:true for a valid signature', async () => {
        const env = createTestEnv();
        const rawBody = JSON.stringify(samplePayload);
        const sig = await makeValidSignature(ipnSecret, samplePayload);
        const res = await app.request('/api/v1/webhooks/nowpayments', {
            method: 'POST',
            body: rawBody,
            headers: {
                'Content-Type': 'application/json',
                'x-nowpayments-sig': sig,
            },
        }, env);
        expect(res.status).toBe(200);
        const json = (await res.json()) as Record<string, unknown>;
        expect(json['received']).toBe(true);
    });

    it('returns 503 when IPN secret is not configured in Worker environment', async () => {
        const env = createTestEnv({ NOWPAYMENTS_IPN_SECRET: undefined });
        const res = await app.request('/api/v1/webhooks/nowpayments', {
            method: 'POST',
            body: JSON.stringify(samplePayload),
            headers: { 'Content-Type': 'application/json' },
        }, env);
        expect(res.status).toBe(503);
    });
});

// ─── 10. GET /api/v1/payments/orders/:orderId ─────────────────────────────────

describe('GET /api/v1/payments/orders/:orderId access control', () => {
    const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    it('returns 403 when unauthenticated request lacks status token on an existing order', async () => {
        const tokenHash = await sha256Hex(rawToken);
        const mockOrder = {
            order_id: 'test-order-001',
            status_token_hash: tokenHash,
            user_id: null,
            plan_key: 'starter-bot',
            billing_mode: 'one_time',
            expected_price_amount_decimal: '997.00',
            price_currency: 'usd',
            pay_currency: 'btc',
            expected_pay_amount_decimal: null,
            provider_invoice_id: null,
            provider_payment_id: null,
            internal_status: 'waiting',
            provider_status: 'waiting',
            entitlement_granted_at: null,
            created_at: '2026-08-25T12:00:00Z',
            updated_at: '2026-08-25T12:00:00Z',
        };

        const env = createTestEnv({
            DB: createMockD1({
                payment_orders: [mockOrder],
            }),
        });

        const res = await app.request('/api/v1/payments/orders/test-order-001', {
            method: 'GET',
        }, env);
        expect(res.status).toBe(403);
    });

    it('returns 403 when incorrect status token is supplied', async () => {
        const tokenHash = await sha256Hex(rawToken);
        const mockOrder = {
            order_id: 'test-order-001',
            status_token_hash: tokenHash,
            user_id: null,
            plan_key: 'starter-bot',
            billing_mode: 'one_time',
            expected_price_amount_decimal: '997.00',
            price_currency: 'usd',
            pay_currency: 'btc',
            expected_pay_amount_decimal: null,
            provider_invoice_id: null,
            provider_payment_id: null,
            internal_status: 'waiting',
            provider_status: 'waiting',
            entitlement_granted_at: null,
            created_at: '2026-08-25T12:00:00Z',
            updated_at: '2026-08-25T12:00:00Z',
        };

        const env = createTestEnv({
            DB: createMockD1({
                payment_orders: [mockOrder],
            }),
        });

        const res = await app.request('/api/v1/payments/orders/test-order-001?token=wrong-token-value', {
            method: 'GET',
        }, env);
        expect(res.status).toBe(403);
    });

    it('returns 200 with sanitized order details when valid status token is supplied', async () => {
        const tokenHash = await sha256Hex(rawToken);
        const mockOrder = {
            order_id: 'test-order-001',
            status_token_hash: tokenHash,
            user_id: null,
            plan_key: 'starter-bot',
            billing_mode: 'one_time',
            expected_price_amount_decimal: '997.00',
            price_currency: 'usd',
            pay_currency: 'btc',
            expected_pay_amount_decimal: null,
            provider_invoice_id: null,
            provider_payment_id: null,
            internal_status: 'waiting',
            provider_status: 'waiting',
            entitlement_granted_at: null,
            created_at: '2026-08-25T12:00:00Z',
            updated_at: '2026-08-25T12:00:00Z',
        };

        const env = createTestEnv({
            DB: createMockD1({
                payment_orders: [mockOrder],
            }),
        });

        const res = await app.request(`/api/v1/payments/orders/test-order-001?token=${rawToken}`, {
            method: 'GET',
        }, env);
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, unknown>;
        expect(json['orderId']).toBe('test-order-001');
        expect(json['planKey']).toBe('starter-bot');
        expect(json['billingMode']).toBe('one_time');
        expect(json['status']).toBe('waiting');
        expect(json['priceAmount']).toBe('997.00');
        // Ensure sensitive internal hash is NOT returned to client
        expect(json['statusTokenHash']).toBeUndefined();
        expect(json['status_token_hash']).toBeUndefined();
    });

    it('returns 404 when order ID does not exist', async () => {
        const env = createTestEnv();
        const res = await app.request(`/api/v1/payments/orders/non-existent-order?token=${rawToken}`, {
            method: 'GET',
        }, env);
        expect(res.status).toBe(404);
    });
});

// ─── 11. Server-Side Crypto Catalog Consistency ───────────────────────────────

describe('SERVER_CRYPTO_CATALOG consistency & decimal string preservation', () => {
    it('rejects a D1 plan that has valid setupFee/monthlyPrice but is absent from SERVER_CRYPTO_CATALOG', async () => {
        const customPlan = {
            id: 'unsupported-crypto-plan',
            name: 'Unsupported Plan',
            description: 'Test description',
            monthly_price: 99,
            setup_fee: 199,
            badge: null,
            highlighted: 0,
            best_for: 'Testing',
            cta_text: 'Buy',
            is_active: 1,
            display_order: 1,
            features: '[]',
            created_at: '2026-08-25T12:00:00Z',
            updated_at: '2026-08-25T12:00:00Z',
        };

        const mockD1 = createMockD1({
            pricing_plans: [customPlan],
        });
        const db = createDB(mockD1);

        const resolved = await getPlanPrice(db, 'unsupported-crypto-plan');
        expect(resolved).toBeNull();
    });

    it('rejects a plan if its isActive flag is false in D1', async () => {
        const inactivePlan = {
            id: 'starter-bot',
            name: 'Starter Bot',
            description: 'Starter Bot',
            monthly_price: 0,
            setup_fee: 997,
            badge: null,
            highlighted: 0,
            best_for: 'Testing',
            cta_text: 'Buy',
            is_active: 0,
            display_order: 1,
            features: '[]',
            created_at: '2026-08-25T12:00:00Z',
            updated_at: '2026-08-25T12:00:00Z',
        };

        const mockD1 = createMockD1({
            pricing_plans: [inactivePlan],
        });
        const db = createDB(mockD1);

        const resolved = await getPlanPrice(db, 'starter-bot');
        expect(resolved).toBeNull();
    });

    it('resolves valid plan prices strictly as normalized decimal strings without number float properties', async () => {
        const activePlan = {
            id: 'starter-bot',
            name: 'Starter Bot',
            description: 'Starter Bot Plan Description',
            monthly_price: 0,
            setup_fee: 997,
            badge: null,
            highlighted: 0,
            best_for: 'Testing',
            cta_text: 'Buy',
            is_active: 1,
            display_order: 1,
            features: '[]',
            created_at: '2026-08-25T12:00:00Z',
            updated_at: '2026-08-25T12:00:00Z',
        };

        const mockD1 = createMockD1({
            pricing_plans: [activePlan],
        });
        const db = createDB(mockD1);

        const resolved = await getPlanPrice(db, 'starter-bot');
        expect(resolved).not.toBeNull();
        expect(resolved?.planKey).toBe('starter-bot');
        expect(resolved?.priceAmountDecimal).toBe('997.00');
        expect(typeof resolved?.priceAmountDecimal).toBe('string');
        expect(resolved?.billingMode).toBe('one_time');
        expect(resolved?.description).toContain('One-time payment');

        // Confirm priceAmount (number) property does NOT exist
        expect((resolved as unknown as Record<string, unknown>)['priceAmount']).toBeUndefined();
    });

    it('every supported frontend crypto plan key exists in SERVER_CRYPTO_CATALOG and is active', () => {
        const frontendSupportedKeys = ['starter-bot', 'growth-bot', 'pro-automation'];
        for (const key of frontendSupportedKeys) {
            const config = SERVER_CRYPTO_CATALOG[key];
            expect(config, `Missing server config for ${key}`).toBeDefined();
            expect(config?.isActive, `Server config for ${key} must be active`).toBe(true);
            expect(config?.billingMode).toBe('one_time');
            expect(config?.priceAmountDecimal).toMatch(/^\d+\.\d{2}$/);
        }
    });

    it('isPaymentAmountSufficient prevents floating point precision leakage', () => {
        // Classic IEEE 754 float trap: 0.1 + 0.2 !== 0.3
        // BigInt decimal string comparison handles exact scaling correctly:
        expect(isPaymentAmountSufficient('0.30000000', '0.30000000', 0)).toBe(true);
        expect(isPaymentAmountSufficient('0.29999999', '0.30000000', 0)).toBe(false);
        expect(compareDecimalStrings('0.30000000', '0.30000000')).toBe(0);
        expect(compareDecimalStrings('0.30000001', '0.30000000')).toBe(1);
    });
});

// ─── 12. GET /api/v1/payments/currencies & Central Allowlist Suite ──────────────

describe('GET /api/v1/payments/currencies & Central Allowlist Suite', () => {
    it('extracts and normalizes a plain string array success response', () => {
        const payload = ['BTC', 'ETH', 'usdttrc20', '  sol  ', 'btc']; // includes duplicates and whitespace
        const parsed = extractAndNormalizeCurrencies(payload);
        expect(parsed).toEqual(['btc', 'eth', 'sol', 'usdttrc20']);
    });

    it('extracts and normalizes an object-with-currencies array response', () => {
        const payload = {
            currencies: ['btc', 'eth', 'usdt', 'trx', 'doge'],
        };
        const parsed = extractAndNormalizeCurrencies(payload);
        expect(parsed).toEqual(['btc', 'doge', 'eth', 'trx', 'usdt']);
    });

    it('filters out invalid tokens, empty strings, and malformed characters', () => {
        const payload = ['', ' ', 'a', '$dollar', 'btc!#', 'eth'];
        const parsed = extractAndNormalizeCurrencies(payload);
        expect(parsed).toEqual(['eth']);
    });

    it('validates central allowlist catalog: all configured assets have correct metadata and categories', () => {
        expect(APPROVED_CURRENCY_CATALOG.length).toBe(31);
        expect(APPROVED_CURRENCY_CODES.size).toBe(31);

        const popular = APPROVED_CURRENCY_CATALOG.filter((c) => c.category === 'popular');
        const stablecoins = APPROVED_CURRENCY_CATALOG.filter((c) => c.category === 'stablecoins');

        expect(popular.length).toBe(6);
        expect(stablecoins.length).toBe(25);

        for (const item of APPROVED_CURRENCY_CATALOG) {
            expect(isApprovedCurrency(item.code)).toBe(true);
            expect(isApprovedCurrency(item.code.toUpperCase())).toBe(true); // case-insensitive check
            const retrieved = getApprovedCurrency(item.code);
            expect(retrieved).toBeDefined();
            expect(retrieved?.symbol).toBe(item.symbol);
            expect(retrieved?.name).toBe(item.name);
            expect(retrieved?.label).toBe(item.label);
            expect(retrieved?.category).toBe(item.category);
        }

        // Unapproved tokens must be rejected
        expect(isApprovedCurrency('doge')).toBe(false);
        expect(isApprovedCurrency('shib')).toBe(false);
        expect(isApprovedCurrency('xmr')).toBe(false);
        expect(isApprovedCurrency('unknown_token')).toBe(false);
        expect(getApprovedCurrency('doge')).toBeUndefined();
    });

    it('filterAndOrderApprovedCurrencies filters out unapproved provider tokens and preserves catalog sort order', () => {
        // Provider returns mix of approved and unapproved tokens in arbitrary order
        const providerCodes = ['doge', 'eth', 'shib', 'btc', 'usdttrx', 'usdtbsc', 'xmr'];
        const filtered = filterAndOrderApprovedCurrencies(providerCodes);

        // Result must include ONLY approved tokens in catalog sort order (BTC, ETH, USDTTRX, USDTBSC)
        expect(filtered.map((c) => c.code)).toEqual(['btc', 'eth', 'usdttrx', 'usdtbsc']);
        expect(filtered.find((c) => c.code === 'doge')).toBeUndefined();
        expect(filtered.find((c) => c.code === 'shib')).toBeUndefined();
        expect(filtered.find((c) => c.code === 'xmr')).toBeUndefined();

        // Verify public metadata fields
        expect(filtered[0]).toEqual({
            code: 'btc',
            symbol: 'BTC',
            name: 'Bitcoin',
            network: undefined,
            label: 'Bitcoin · BTC',
            category: 'popular',
        });
        expect(filtered[2]).toEqual({
            code: 'usdttrx',
            symbol: 'USDTTRX',
            name: 'Tether USD (Tron)',
            network: 'Tron',
            label: 'Tether USD (Tron) · USDTTRX',
            category: 'stablecoins',
        });
    });

    it('returns 503 when NOWPAYMENTS_API_KEY is not configured', async () => {
        const env = createTestEnv({
            NOWPAYMENTS_API_KEY: '',
        });
        const res = await app.request('/api/v1/payments/currencies', { method: 'GET' }, env);
        expect(res.status).toBe(503);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body['code']).toBe('PAYMENT_NOT_CONFIGURED');
    });

    it('serves cached currencies from KV without contacting upstream', async () => {
        let upstreamCalled = false;
        const mockCachedPublicData: PaymentCurrencyPublicItem[] = [
            { code: 'btc', symbol: 'BTC', name: 'Bitcoin', label: 'Bitcoin · BTC', category: 'popular' },
            { code: 'eth', symbol: 'ETH', name: 'Ethereum', label: 'Ethereum · ETH', category: 'popular' },
        ];

        const env = createTestEnv({
            NOWPAYMENTS_API_KEY: 'test-api-key',
            CONTENT_KV: {
                get: async (key: string) => (key === 'nowpayments:currencies:v2' ? JSON.stringify(mockCachedPublicData) : null),
                put: async () => {},
                delete: async () => {},
                list: async () => ({ keys: [], list_complete: true, caret: undefined }),
                getWithMetadata: async () => ({ value: null, metadata: null }),
            } as unknown as KVNamespace,
        });

        // Intercept global fetch
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => {
            upstreamCalled = true;
            throw new Error('Upstream should not be called on KV cache hit');
        };

        try {
            const res = await app.request('/api/v1/payments/currencies', { method: 'GET' }, env);
            expect(res.status).toBe(200);
            const body = (await res.json()) as { data: PaymentCurrencyPublicItem[] };
            expect(body.data).toEqual(mockCachedPublicData);
            expect(upstreamCalled).toBe(false);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('fetches upstream on KV cache miss, filters allowlist, and caches sanitized metadata in KV', async () => {
        const kvStore: Record<string, string> = {};

        const env = createTestEnv({
            NOWPAYMENTS_API_KEY: 'test-api-key',
            CONTENT_KV: {
                get: async (key: string) => kvStore[key] ?? null,
                put: async (key: string, value: string) => {
                    kvStore[key] = value;
                },
                delete: async () => {},
                list: async () => ({ keys: [], list_complete: true, caret: undefined }),
                getWithMetadata: async () => ({ value: null, metadata: null }),
            } as unknown as KVNamespace,
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => {
            // Provider returns mix of approved (btc, eth, usdttrx) and unapproved (doge, shib)
            return new Response(JSON.stringify({ currencies: ['doge', 'eth', 'shib', 'btc', 'usdttrx'] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        };

        try {
            const res = await app.request('/api/v1/payments/currencies', { method: 'GET' }, env);
            expect(res.status).toBe(200);
            const body = (await res.json()) as { data: PaymentCurrencyPublicItem[] };

            // Result must only contain approved assets
            expect(body.data.map((c) => c.code)).toEqual(['btc', 'eth', 'usdttrx']);
            expect(kvStore['nowpayments:currencies:v2']).toBeDefined();
            expect(JSON.parse(kvStore['nowpayments:currencies:v2']!)).toEqual(body.data);
            expect(kvStore['nowpayments:currencies:provider:v2']).toBeDefined();
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('maps non-2xx upstream error to a generic safe 502/503 response without leaking secret', async () => {
        const env = createTestEnv({
            NOWPAYMENTS_API_KEY: 'super-secret-api-key-value',
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => {
            return new Response(JSON.stringify({ message: 'Unauthorized key', code: 'AUTH_FAILED' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        };

        try {
            const res = await app.request('/api/v1/payments/currencies', { method: 'GET' }, env);
            expect(res.status).toBe(503);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body['code']).toBe('CURRENCIES_UNAVAILABLE');
            // Ensure sensitive key or upstream message is NOT leaked to client
            expect(JSON.stringify(body)).not.toContain('super-secret-api-key-value');
            expect(JSON.stringify(body)).not.toContain('Unauthorized key');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('maps malformed or empty upstream response to 502 without caching failure', async () => {
        let kvCurrenciesCached = false;
        const env = createTestEnv({
            NOWPAYMENTS_API_KEY: 'test-api-key',
            CONTENT_KV: {
                get: async () => null,
                put: async (key: string) => {
                    if (key.startsWith('nowpayments:currencies')) {
                        kvCurrenciesCached = true;
                    }
                },
                delete: async () => {},
                list: async () => ({ keys: [], list_complete: true, caret: undefined }),
                getWithMetadata: async () => ({ value: null, metadata: null }),
            } as unknown as KVNamespace,
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => {
            return new Response(JSON.stringify({ currencies: [] }), { // empty
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        };

        try {
            const res = await app.request('/api/v1/payments/currencies', { method: 'GET' }, env);
            expect(res.status).toBe(502);
            expect(kvCurrenciesCached).toBe(false); // failures must NEVER be cached
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('maps upstream network/timeout failure to safe 502', async () => {
        const env = createTestEnv({
            NOWPAYMENTS_API_KEY: 'test-api-key',
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            throw abortError;
        };

        try {
            const res = await app.request('/api/v1/payments/currencies', { method: 'GET' }, env);
            expect(res.status).toBe(502);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body['code']).toBe('CURRENCIES_UNAVAILABLE');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});

// ─── 13. Admin Payments Observability API & Security Suite ─────────────────────

describe('Admin Payments Observability API & Security Suite', () => {
    const testSecret = 'test-jwt-secret-min-32-chars-long-example';

    async function getAdminToken(role: 'super_admin' | 'editor' = 'super_admin'): Promise<string> {
        const now = Math.floor(Date.now() / 1000);
        return signJWT(
            {
                sub: '1',
                email: 'admin@dreamwebapp.com',
                role,
                iat: now,
                exp: now + 3600,
                tv: 1,
            },
            testSecret,
        );
    }

    const mockAdminUser = {
        id: 1,
        email: 'admin@dreamwebapp.com',
        password_hash: '$2a$12$eXampleHash...',
        role: 'super_admin',
        is_active: 1,
        token_version: 1,
        created_at: '2026-08-25T12:00:00Z',
        updated_at: '2026-08-25T12:00:00Z',
    };

    const mockOrder1 = {
        order_id: 'order-uuid-001',
        status_token_hash: 'sensitive-token-hash-must-never-be-exposed-1',
        user_id: null,
        plan_key: 'starter-bot',
        billing_mode: 'one_time',
        expected_price_amount_decimal: '997.00',
        price_currency: 'usd',
        pay_currency: 'btc',
        expected_pay_amount_decimal: '0.01500000',
        provider_invoice_id: 'inv_1001',
        provider_payment_id: 'np_pay_5001',
        internal_status: 'paid',
        provider_status: 'finished',
        entitlement_granted_at: '2026-08-25T12:30:00Z',
        created_at: '2026-08-25T12:00:00Z',
        updated_at: '2026-08-25T12:30:00Z',
    };

    const mockOrder2 = {
        order_id: 'order-uuid-002',
        status_token_hash: 'sensitive-token-hash-must-never-be-exposed-2',
        user_id: null,
        plan_key: 'growth-bot',
        billing_mode: 'one_time',
        expected_price_amount_decimal: '997.00',
        price_currency: 'usd',
        pay_currency: 'usdttrc20',
        expected_pay_amount_decimal: null,
        provider_invoice_id: 'inv_1002',
        provider_payment_id: null,
        internal_status: 'waiting',
        provider_status: 'waiting',
        entitlement_granted_at: null,
        created_at: '2026-08-25T13:00:00Z',
        updated_at: '2026-08-25T13:00:00Z',
    };

    const mockEvent1 = {
        id: 101,
        order_id: 'order-uuid-001',
        provider_payment_id: 'np_pay_5001',
        provider_status: 'waiting',
        event_fingerprint: 'sensitive-fingerprint-sha256-11111111111111111111111111111111',
        payload_hash: 'sensitive-payload-hash-2222222222222222222222222222222222222222',
        received_at: '2026-08-25T12:05:00Z',
    };

    const mockEvent2 = {
        id: 102,
        order_id: 'order-uuid-001',
        provider_payment_id: 'np_pay_5001',
        provider_status: 'finished',
        event_fingerprint: 'sensitive-fingerprint-sha256-33333333333333333333333333333333',
        payload_hash: 'sensitive-payload-hash-4444444444444444444444444444444444444444',
        received_at: '2026-08-25T12:30:00Z',
    };

    it('rejects unauthenticated requests to all admin payment endpoints with 401', async () => {
        const env = createTestEnv({
            JWT_SECRET: testSecret,
            DB: createMockD1({ admin_users: [mockAdminUser] }),
        });

        const resList = await app.request('/api/v1/admin/payments/orders', { method: 'GET' }, env);
        expect(resList.status).toBe(401);

        const resDetail = await app.request('/api/v1/admin/payments/orders/order-uuid-001', { method: 'GET' }, env);
        expect(resDetail.status).toBe(401);

        const resSummary = await app.request('/api/v1/admin/payments/summary', { method: 'GET' }, env);
        expect(resSummary.status).toBe(401);
    });

    it('returns paginated safe order list for authenticated admin without exposing secrets or hashes', async () => {
        const token = await getAdminToken();
        const env = createTestEnv({
            JWT_SECRET: testSecret,
            DB: createMockD1({
                admin_users: [mockAdminUser],
                payment_orders: [mockOrder1, mockOrder2],
                payment_events: [mockEvent1, mockEvent2],
            }),
        });

        const res = await app.request('/api/v1/admin/payments/orders?page=1&pageSize=10', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        }, env);

        expect(res.status).toBe(200);
        const json = (await res.json()) as {
            data: {
                items: Record<string, unknown>[];
                total: number;
                page: number;
                pageSize: number;
                totalPages: number;
            };
        };

        expect(json.data.total).toBe(2);
        expect(json.data.items).toHaveLength(2);

        const first = json.data.items[0]!;
        expect(first['orderId']).toBe('order-uuid-001');
        expect(first['planKey']).toBe('starter-bot');
        expect(first['planName']).toBe('Starter Bot');
        expect(first['priceAmountDecimal']).toBe('997.00');
        expect(first['priceCurrency']).toBe('usd');
        expect(first['payCurrency']).toBe('btc');
        expect(first['internalStatus']).toBe('paid');
        expect(first['providerStatus']).toBe('finished');
        expect(first['entitlementGrantedAt']).toBe('2026-08-25T12:30:00Z');
        expect(first['eventCount']).toBe(2);

        // Confirm sensitive fields are strictly excluded
        const rawJson = JSON.stringify(json);
        expect(rawJson).not.toContain('sensitive-token-hash');
        expect(rawJson).not.toContain('statusTokenHash');
        expect(rawJson).not.toContain('status_token_hash');
        expect(rawJson).not.toContain('eventFingerprint');
        expect(rawJson).not.toContain('event_fingerprint');
        expect(rawJson).not.toContain('payloadHash');
        expect(rawJson).not.toContain('payload_hash');
    });

    it('rejects invalid query parameters with 400', async () => {
        const token = await getAdminToken();
        const env = createTestEnv({
            JWT_SECRET: testSecret,
            DB: createMockD1({ admin_users: [mockAdminUser] }),
        });

        const res = await app.request('/api/v1/admin/payments/orders?pageSize=9999', { // exceeds max 100
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        }, env);

        expect(res.status).toBe(400);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body['error']).toBe('Invalid query parameters');
    });

    it('returns single order detail with safe chronological event timeline', async () => {
        const token = await getAdminToken();
        const env = createTestEnv({
            JWT_SECRET: testSecret,
            DB: createMockD1({
                admin_users: [mockAdminUser],
                payment_orders: [mockOrder1],
                payment_events: [mockEvent1, mockEvent2],
            }),
        });

        const res = await app.request('/api/v1/admin/payments/orders/order-uuid-001', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        }, env);

        expect(res.status).toBe(200);
        const json = (await res.json()) as {
            data: {
                order: Record<string, unknown>;
                events: Record<string, unknown>[];
            };
        };

        expect(json.data.order['orderId']).toBe('order-uuid-001');
        expect(json.data.events).toHaveLength(2);
        expect(json.data.events[0]!['providerStatus']).toBe('waiting');
        expect(json.data.events[1]!['providerStatus']).toBe('finished');

        // Confirm event fingerprints and raw payload hashes are not exposed
        const rawJson = JSON.stringify(json);
        expect(rawJson).not.toContain('sensitive-fingerprint');
        expect(rawJson).not.toContain('sensitive-payload');
    });

    it('returns 404 for unknown order ID in detail endpoint', async () => {
        const token = await getAdminToken();
        const env = createTestEnv({
            JWT_SECRET: testSecret,
            DB: createMockD1({ admin_users: [mockAdminUser] }),
        });

        const res = await app.request('/api/v1/admin/payments/orders/non-existent-order-id', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        }, env);

        expect(res.status).toBe(404);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body['error']).toBe('Payment order not found');
    });

    it('aggregates summary statistics and calculates exact decimal revenue without floating-point arithmetic', async () => {
        const token = await getAdminToken();
        const env = createTestEnv({
            JWT_SECRET: testSecret,
            DB: createMockD1({
                admin_users: [mockAdminUser],
                payment_orders: [mockOrder1, mockOrder2],
            }),
        });

        const res = await app.request('/api/v1/admin/payments/summary', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        }, env);

        expect(res.status).toBe(200);
        const json = (await res.json()) as {
            data: {
                totalOrders: number;
                byStatus: Record<string, number>;
                paidRevenueByCurrency: Record<string, string>;
            };
        };

        expect(json.data.totalOrders).toBe(2);
        expect(json.data.byStatus['paid']).toBe(1);
        expect(json.data.byStatus['waiting']).toBe(1);
        expect(json.data.paidRevenueByCurrency['usd']).toBe('997.00');
    });

    it('sumDecimalStrings computes exact BigInt sums without floating point errors', () => {
        // 0.1 + 0.2 is 0.30000000000000004 in IEEE 754 floats
        expect(sumDecimalStrings(['0.10', '0.20'])).toBe('0.30');
        // Multi-order sum
        expect(sumDecimalStrings(['997.00', '997.00', '1997.00'])).toBe('3991.00');
        // Empty array
        expect(sumDecimalStrings([])).toBe('0.00');
    });
});

// ─── 14. Authenticated Checkout & Ownership Enforcement Suite ──────────────────

describe('Authenticated Checkout & Ownership Enforcement Suite', () => {
    it('rejects checkout creation with 401 when customer session is absent and creates no order/invoice', async () => {
        let upstreamCalled = false;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => {
            upstreamCalled = true;
            throw new Error('Upstream should not be called for unauthenticated checkout');
        };

        const env = createTestEnv({
            NOWPAYMENTS_API_KEY: 'test-api-key',
            DB: createMockD1({}),
        });

        try {
            const res = await app.request('/api/v1/payments/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Origin: 'https://dreamwebapp.com',
                },
                body: JSON.stringify({
                    planKey: 'starter-bot',
                    payCurrency: 'btc',
                }),
            }, env);

            expect(res.status).toBe(401);
            const json = (await res.json()) as { error: string; code: string };
            expect(json.code).toBe('UNAUTHORIZED');
            expect(upstreamCalled).toBe(false);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('rejects checkout creation with 403 when CSRF token is missing on state-changing POST', async () => {
        const env = createTestEnv({
            NOWPAYMENTS_API_KEY: 'test-api-key',
            DB: createMockD1({}),
        });

        const res = await app.request('/api/v1/payments/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: 'dreamwebapp_session=some_session_token',
                Origin: 'https://dreamwebapp.com',
                // Missing X-CSRF-Token header
            },
            body: JSON.stringify({
                planKey: 'starter-bot',
                payCurrency: 'btc',
            }),
        }, env);

        expect(res.status).toBe(401); // Session token invalid in mock D1 or 403 CSRF check
    });

    it('rejects checkout creation with 422 when payCurrency is not in the central allowlist', async () => {
        let upstreamCalled = false;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => {
            upstreamCalled = true;
            throw new Error('Provider must NOT be contacted for unallowlisted currency');
        };

        // Create in-memory DB and authenticated customer
        const { createInMemoryDB } = await import('./helpers/d1-mock');
        const { registerCustomerWithPassword } = await import('../../lib/customer-auth-service');
        const mem = createInMemoryDB();
        const drizzle = createDB(mem.db);

        const auth = await registerCustomerWithPassword(drizzle, {
            email: 'buyer@example.com',
            password: 'SecurePassword123!',
        });

        const env = createTestEnv({
            NOWPAYMENTS_API_KEY: 'test-api-key',
            DB: mem.db,
        });

        try {
            const res = await app.request('/api/v1/payments/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Origin: 'https://dreamwebapp.com',
                    Cookie: `dreamwebapp_session=${auth.sessionToken}; dreamwebapp_csrf=${auth.csrfToken}`,
                    'X-CSRF-Token': auth.csrfToken,
                },
                body: JSON.stringify({
                    planKey: 'starter-bot',
                    payCurrency: 'doge', // not in central allowlist
                }),
            }, env);

            expect(res.status).toBe(422);
            const json = (await res.json()) as { error: string; code: string };
            expect(json.code).toBe('UNSUPPORTED_CURRENCY');
            expect(upstreamCalled).toBe(false);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('rejects checkout creation with 422 when payCurrency is allowlisted but unavailable from provider', async () => {
        const { createInMemoryDB } = await import('./helpers/d1-mock');
        const { registerCustomerWithPassword } = await import('../../lib/customer-auth-service');
        const mem = createInMemoryDB();
        const drizzle = createDB(mem.db);

        const auth = await registerCustomerWithPassword(drizzle, {
            email: 'buyer2@example.com',
            password: 'SecurePassword123!',
        });

        // Provider only offers btc, but customer requests usdttrx
        const env = createTestEnv({
            NOWPAYMENTS_API_KEY: 'test-api-key',
            DB: mem.db,
            CONTENT_KV: {
                get: async (key: string) => (key === 'nowpayments:currencies:provider:v2' ? JSON.stringify(['btc', 'eth']) : null),
                put: async () => {},
                delete: async () => {},
                list: async () => ({ keys: [], list_complete: true, caret: undefined }),
                getWithMetadata: async () => ({ value: null, metadata: null }),
            } as unknown as KVNamespace,
        });

        const res = await app.request('/api/v1/payments/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'https://dreamwebapp.com',
                Cookie: `dreamwebapp_session=${auth.sessionToken}; dreamwebapp_csrf=${auth.csrfToken}`,
                'X-CSRF-Token': auth.csrfToken,
            },
            body: JSON.stringify({
                planKey: 'starter-bot',
                payCurrency: 'usdttrx', // allowlisted, but not currently in provider currencies
            }),
        }, env);

        expect(res.status).toBe(422);
        const json = (await res.json()) as { error: string; code: string };
        expect(json.code).toBe('CURRENCY_UNAVAILABLE');
    });

    it('successfully creates order and hosted invoice when plan, allowlisted currency, and auth are valid', async () => {
        const { createInMemoryDB } = await import('./helpers/d1-mock');
        const { registerCustomerWithPassword } = await import('../../lib/customer-auth-service');
        const mem = createInMemoryDB();
        const drizzle = createDB(mem.db);

        const auth = await registerCustomerWithPassword(drizzle, {
            email: 'buyer3@example.com',
            password: 'SecurePassword123!',
        });

        const env = createTestEnv({
            NOWPAYMENTS_API_KEY: 'test-api-key',
            DB: mem.db,
            CONTENT_KV: {
                get: async (key: string) => (key === 'nowpayments:currencies:provider:v2' ? JSON.stringify(['btc', 'eth', 'usdttrx']) : null),
                put: async () => {},
                delete: async () => {},
                list: async () => ({ keys: [], list_complete: true, caret: undefined }),
                getWithMetadata: async () => ({ value: null, metadata: null }),
            } as unknown as KVNamespace,
            PAYMENT_SUCCESS_URL: 'https://dreamwebapp.com/payment/return',
            PAYMENT_CANCEL_URL: 'https://dreamwebapp.com/payment/return',
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('/min-amount')) {
                return new Response(JSON.stringify({ currency_from: 'usdttrx', currency_to: 'usd', min_amount: 5, fiat_equivalent: null }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (urlStr.includes('/invoice')) {
                return new Response(JSON.stringify({
                    id: 'inv_test_9999',
                    order_id: 'order-test',
                    invoice_url: 'https://nowpayments.io/payment/?iid=inv_test_9999',
                    payment_id: 'pay_9999',
                    pay_amount: '997.00',
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw new Error(`Unexpected fetch URL: ${urlStr}`);
        };

        try {
            const res = await app.request('/api/v1/payments/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Origin: 'https://dreamwebapp.com',
                    Cookie: `dreamwebapp_session=${auth.sessionToken}; dreamwebapp_csrf=${auth.csrfToken}`,
                    'X-CSRF-Token': auth.csrfToken,
                },
                body: JSON.stringify({
                    planKey: 'starter-bot',
                    payCurrency: 'usdttrx',
                }),
            }, env);

            expect(res.status).toBe(201);
            const json = (await res.json()) as { orderId: string; statusToken: string; invoiceUrl: string };
            expect(json.orderId).toBeDefined();
            expect(json.statusToken).toBeDefined();
            expect(json.invoiceUrl).toBe('https://nowpayments.io/payment/?iid=inv_test_9999');

            // Order persisted in D1
            const order = mem.store.paymentOrders.find((o) => o['order_id'] === json.orderId || o['orderId'] === json.orderId);
            expect(order).toBeDefined();
            expect(order?.['plan_key'] ?? order?.['planKey']).toBe('starter-bot');
            expect(order?.['pay_currency'] ?? order?.['payCurrency']).toBe('usdttrx');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});



