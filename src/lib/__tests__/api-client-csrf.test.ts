import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCsrfTokenFromCookie, customerFetch } from '../api-client';

describe('Frontend CSRF Token & customerFetch Integration Tests', () => {
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

    describe('getCsrfTokenFromCookie', () => {
        it('returns null when document.cookie is empty', () => {
            document.cookie = '';
            expect(getCsrfTokenFromCookie()).toBeNull();
        });

        it('returns null when dreamwebapp_csrf cookie is not present', () => {
            document.cookie = 'other_cookie=value; dreamwebapp_session=abc';
            expect(getCsrfTokenFromCookie()).toBeNull();
        });

        it('extracts and decodes dreamwebapp_csrf token value correctly', () => {
            document.cookie = 'dreamwebapp_csrf=csrf_secret_token_12345; other_cookie=xyz';
            expect(getCsrfTokenFromCookie()).toBe('csrf_secret_token_12345');
        });
    });

    describe('customerFetch CSRF header attachment', () => {
        it('includes X-CSRF-Token on state-changing POST requests when cookie is present', async () => {
            document.cookie = 'dreamwebapp_csrf=my-valid-csrf-token';
            let capturedHeaders: HeadersInit | undefined;

            globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
                capturedHeaders = init?.headers;
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ success: true }),
                } as Response;
            });

            await customerFetch('/api/v1/auth/email-verification/resend', {
                method: 'POST',
            });

            expect(capturedHeaders).toHaveProperty('X-CSRF-Token', 'my-valid-csrf-token');
        });

        it('does NOT fabricate or attach X-CSRF-Token on state-changing requests when cookie is absent', async () => {
            document.cookie = '';
            let capturedHeaders: HeadersInit | undefined;

            globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
                capturedHeaders = init?.headers;
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ success: true }),
                } as Response;
            });

            await customerFetch('/api/v1/auth/email-verification/resend', {
                method: 'POST',
            });

            expect(capturedHeaders).not.toHaveProperty('X-CSRF-Token');
        });

        it('does NOT attach X-CSRF-Token on GET requests even when cookie is present', async () => {
            document.cookie = 'dreamwebapp_csrf=my-valid-csrf-token';
            let capturedHeaders: HeadersInit | undefined;

            globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
                capturedHeaders = init?.headers;
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ id: 'usr_1', email: 'test@example.com' }),
                } as Response;
            });

            await customerFetch('/api/v1/auth/me');

            expect(capturedHeaders).not.toHaveProperty('X-CSRF-Token');
        });
    });
});
