import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    fetchPaymentCurrencies,
    createCheckout,
    isValidNowPaymentsInvoiceUrl,
    type PaymentCurrencyData,
} from '../api-client';

describe('Frontend Crypto Checkout Flow & Security Tests', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.restoreAllMocks();
        (globalThis as unknown as { document: { cookie: string } }).document = {
            cookie: '',
        };
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe('isValidNowPaymentsInvoiceUrl', () => {
        it('accepts valid HTTPS nowpayments.io hosted invoice URLs', () => {
            expect(isValidNowPaymentsInvoiceUrl('https://nowpayments.io/payment/?iid=5077461678')).toBe(true);
            expect(isValidNowPaymentsInvoiceUrl('https://api.nowpayments.io/v1/invoice/123')).toBe(true);
            expect(isValidNowPaymentsInvoiceUrl('https://checkout.nowpayments.io/invoice/456')).toBe(true);
            expect(isValidNowPaymentsInvoiceUrl('https://sandbox.nowpayments.io/payment/?iid=789')).toBe(true);
        });

        it('rejects plain HTTP URLs', () => {
            expect(isValidNowPaymentsInvoiceUrl('http://nowpayments.io/payment/?iid=5077461678')).toBe(false);
        });

        it('rejects arbitrary / malicious external redirect targets', () => {
            expect(isValidNowPaymentsInvoiceUrl('https://evil-phishing-site.com/payment')).toBe(false);
            expect(isValidNowPaymentsInvoiceUrl('https://nowpayments.io.attacker.com/payment')).toBe(false);
            expect(isValidNowPaymentsInvoiceUrl('https://google.com')).toBe(false);
            expect(isValidNowPaymentsInvoiceUrl('javascript:alert(1)')).toBe(false);
            expect(isValidNowPaymentsInvoiceUrl('data:text/html,<script>evil</script>')).toBe(false);
        });

        it('handles null, undefined, and empty string safely without throwing', () => {
            expect(isValidNowPaymentsInvoiceUrl(null)).toBe(false);
            expect(isValidNowPaymentsInvoiceUrl(undefined)).toBe(false);
            expect(isValidNowPaymentsInvoiceUrl('')).toBe(false);
            expect(isValidNowPaymentsInvoiceUrl('not-a-url')).toBe(false);
        });
    });

    describe('fetchPaymentCurrencies API client', () => {
        it('fetches and returns typed payment currency data from /api/v1/payments/currencies', async () => {
            const mockData: PaymentCurrencyData[] = [
                { code: 'btc', symbol: 'BTC', name: 'Bitcoin', label: 'Bitcoin · BTC', category: 'popular' },
                { code: 'usdttrx', symbol: 'USDTTRX', name: 'Tether USD (Tron)', network: 'Tron', label: 'Tether USD (Tron) · USDTTRX', category: 'stablecoins' },
            ];

            globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
                expect(url).toContain('/api/v1/payments/currencies');
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ data: mockData, timestamp: new Date().toISOString() }),
                } as Response;
            });

            const result = await fetchPaymentCurrencies();
            expect(result).toEqual(mockData);
            expect(result.length).toBe(2);
            expect(result[0]?.code).toBe('btc');
            expect(result[0]?.category).toBe('popular');
            expect(result[1]?.code).toBe('usdttrx');
            expect(result[1]?.category).toBe('stablecoins');
        });
    });

    describe('createCheckout API client', () => {
        it('sends planKey and payCurrency with CSRF token and credentials', async () => {
            document.cookie = 'dreamwebapp_csrf=csrf-token-abc-123';
            let capturedInit: RequestInit | undefined;
            let capturedUrl = '';

            globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
                capturedUrl = url;
                capturedInit = init;
                return {
                    ok: true,
                    status: 201,
                    json: async () => ({
                        data: {
                            orderId: 'ord_uuid_001',
                            statusToken: 'raw_token_xyz',
                            invoiceUrl: 'https://nowpayments.io/payment/?iid=12345',
                        },
                    }),
                } as Response;
            });

            const result = await createCheckout({
                planKey: 'starter-bot',
                payCurrency: 'usdttrx',
                billingMode: 'one_time',
            });

            expect(capturedUrl).toContain('/api/v1/payments/checkout');
            expect(capturedInit?.method).toBe('POST');
            expect(capturedInit?.credentials).toBe('include');
            expect(capturedInit?.headers).toHaveProperty('X-CSRF-Token', 'csrf-token-abc-123');

            const body = JSON.parse(String(capturedInit?.body));
            expect(body).toEqual({
                planKey: 'starter-bot',
                payCurrency: 'usdttrx',
                billingMode: 'one_time',
            });

            expect(result.orderId).toBe('ord_uuid_001');
            expect(result.invoiceUrl).toBe('https://nowpayments.io/payment/?iid=12345');
        });

        it('throws ApiError on 422 validation failure with server error message', async () => {
            document.cookie = 'dreamwebapp_csrf=csrf-token-abc-123';

            globalThis.fetch = vi.fn().mockImplementation(async () => {
                return {
                    ok: false,
                    status: 422,
                    json: async () => ({
                        error: "Cryptocurrency 'DOGE' is not supported for checkout",
                        code: 'UNSUPPORTED_CURRENCY',
                    }),
                } as Response;
            });

            await expect(
                createCheckout({
                    planKey: 'starter-bot',
                    payCurrency: 'doge',
                }),
            ).rejects.toThrow("Cryptocurrency 'DOGE' is not supported for checkout");
        });
    });
});
