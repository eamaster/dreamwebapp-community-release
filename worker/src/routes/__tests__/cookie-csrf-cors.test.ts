import { describe, it, expect, vi } from 'vitest';
import app from '../../index';
import type { Env } from '../../types/env';
import {
    getValidatedCookieDomain,
    setCustomerCookies,
    clearCustomerCookies,
    SESSION_COOKIE_NAME,
    CSRF_COOKIE_NAME,
} from '../../middleware/customer-auth';
import { registerCustomerWithPassword } from '../../lib/customer-auth-service';
import { createDB } from '../../db';
import { createInMemoryDB } from './helpers/d1-mock';



// ─── Shared production-like env (no secrets in plain text) ────────────────────

const BASE_ENV: Env = {
    DB: null as unknown as D1Database, // replaced per-test
    CONTENT_KV: {} as KVNamespace,
    LOGO_ASSETS: {} as R2Bucket,
    AI: {} as Ai,
    JWT_SECRET: 'test-jwt-secret-32-chars-long!!!',
    RESEND_API_KEY: 're_mock_000000000000000000000000000',
    RESEND_FROM_EMAIL: 'DreamWebApp <no-reply@dreamwebapp.com>',
    CORS_ORIGIN: 'https://dreamwebapp.com,https://www.dreamwebapp.com',
    PUBLIC_APP_ORIGIN: 'https://dreamwebapp.com',
    COOKIE_DOMAIN: 'dreamwebapp.com',
    ENVIRONMENT: 'production',
};

// ─── §1 · getValidatedCookieDomain unit tests ─────────────────────────────────

describe('§1 · getValidatedCookieDomain', () => {
    it('returns undefined in development (never sets Domain in dev)', () => {
        expect(getValidatedCookieDomain({ ENVIRONMENT: 'development', COOKIE_DOMAIN: 'example.com' })).toBeUndefined();
    });

    it('returns undefined when ENVIRONMENT is unset', () => {
        expect(getValidatedCookieDomain({ COOKIE_DOMAIN: 'example.com' })).toBeUndefined();
    });

    it('returns normalized domain in production', () => {
        expect(getValidatedCookieDomain({
            ENVIRONMENT: 'production',
            COOKIE_DOMAIN: 'dreamwebapp.com',
            CORS_ORIGIN: 'https://dreamwebapp.com,https://www.dreamwebapp.com',
        })).toBe('dreamwebapp.com');
    });

    it('strips leading dot from COOKIE_DOMAIN value', () => {
        expect(getValidatedCookieDomain({
            ENVIRONMENT: 'production',
            COOKIE_DOMAIN: '.dreamwebapp.com',
            CORS_ORIGIN: 'https://dreamwebapp.com',
        })).toBe('dreamwebapp.com');
    });

    it('throws when COOKIE_DOMAIN is missing in production', () => {
        expect(() => getValidatedCookieDomain({ ENVIRONMENT: 'production' }))
            .toThrow(/COOKIE_DOMAIN is required in production/);
    });

    it('throws when COOKIE_DOMAIN contains a port', () => {
        expect(() => getValidatedCookieDomain({ ENVIRONMENT: 'production', COOKIE_DOMAIN: 'example.com:8080' }))
            .toThrow(/plain DNS domain/);
    });

    it('throws when COOKIE_DOMAIN contains a path segment', () => {
        expect(() => getValidatedCookieDomain({ ENVIRONMENT: 'production', COOKIE_DOMAIN: 'example.com/evil' }))
            .toThrow(/plain DNS domain/);
    });

    it('throws when CORS_ORIGIN includes an HTTPS origin not under COOKIE_DOMAIN', () => {
        expect(() => getValidatedCookieDomain({
            ENVIRONMENT: 'production',
            COOKIE_DOMAIN: 'goodsite.com',
            CORS_ORIGIN: 'https://goodsite.com,https://evilsite.com',
        })).toThrow(/shared parent/);
    });

    it('ignores http:// origins in CORS_ORIGIN when cross-validating (dev localhost)', () => {
        // Localhost / non-HTTPS origins are not subject to domain cross-validation
        expect(() => getValidatedCookieDomain({
            ENVIRONMENT: 'production',
            COOKIE_DOMAIN: 'dreamwebapp.com',
            CORS_ORIGIN: 'https://dreamwebapp.com,http://localhost:5173',
        })).not.toThrow();
    });
});

// ─── §2 · setCustomerCookies / clearCustomerCookies unit tests ────────────────

/** Builds a minimal Hono Context stub for cookie-setter tests. */
function makeContextStub(envOverrides: Partial<Env> = {}): {
    c: Parameters<typeof setCustomerCookies>[0];
    getHeaders: () => string[];
} {
    const headers: string[] = [];
    const env = { ...BASE_ENV, ...envOverrides };
    const c = {
        env,
        header(name: string, value: string, opts?: { append?: boolean }) {
            void name; void opts;
            headers.push(value);
        },
    } as unknown as Parameters<typeof setCustomerCookies>[0];
    return { c, getHeaders: () => headers };
}

describe('§2 · setCustomerCookies and clearCustomerCookies', () => {
    describe('setCustomerCookies in production', () => {
        it('emits three Set-Cookie directives (session + legacy-expiry + scoped-csrf)', () => {
            const { c, getHeaders } = makeContextStub();
            setCustomerCookies(c, 'session-tok', 'csrf-tok', true);
            const hdrs = getHeaders();
            expect(hdrs).toHaveLength(3);
        });

        it('session cookie is HttpOnly and host-scoped (no Domain)', () => {
            const { c, getHeaders } = makeContextStub();
            setCustomerCookies(c, 'session-tok', 'csrf-tok', true);
            const session = getHeaders().find((h) => h.startsWith(`${SESSION_COOKIE_NAME}=`));
            expect(session).toContain('HttpOnly');
            expect(session).toContain('Secure');
            expect(session).toContain('SameSite=Lax');
            expect(session).not.toContain('Domain=');
        });

        it('legacy expiry directive has Max-Age=0 and no Domain (targets host-only scope)', () => {
            const { c, getHeaders } = makeContextStub();
            setCustomerCookies(c, 's', 'c', true);
            const legacyExpiry = getHeaders().filter((h) => h.startsWith(`${CSRF_COOKIE_NAME}=`))[0];
            expect(legacyExpiry).toContain('Max-Age=0');
            expect(legacyExpiry).not.toContain('Domain=');
        });

        it('domain-scoped CSRF cookie is non-HttpOnly and carries Domain=', () => {
            const { c, getHeaders } = makeContextStub();
            setCustomerCookies(c, 's', 'csrf-tok', true);
            const domainCsrf = getHeaders().filter((h) => h.startsWith(`${CSRF_COOKIE_NAME}=`))[1];
            expect(domainCsrf).not.toContain('HttpOnly');
            expect(domainCsrf).toContain('Secure');
            expect(domainCsrf).toContain('SameSite=Lax');
            expect(domainCsrf).toContain('Domain=dreamwebapp.com');
        });
    });

    describe('setCustomerCookies in development', () => {
        it('emits only two Set-Cookie directives (session + csrf, no legacy expiry)', () => {
            const { c, getHeaders } = makeContextStub({ ENVIRONMENT: 'development', COOKIE_DOMAIN: undefined });
            setCustomerCookies(c, 's', 'c', false);
            expect(getHeaders()).toHaveLength(2);
        });

        it('session cookie has no Secure flag in development', () => {
            const { c, getHeaders } = makeContextStub({ ENVIRONMENT: 'development', COOKIE_DOMAIN: undefined });
            setCustomerCookies(c, 's', 'c', false);
            const session = getHeaders().find((h) => h.startsWith(`${SESSION_COOKIE_NAME}=`));
            expect(session).not.toContain('Secure');
        });
    });

    describe('clearCustomerCookies in production', () => {
        it('emits three Max-Age=0 directives (session + legacy-csrf + scoped-csrf)', () => {
            const { c, getHeaders } = makeContextStub();
            clearCustomerCookies(c, true);
            const hdrs = getHeaders();
            expect(hdrs).toHaveLength(3);
            expect(hdrs.every((h) => h.includes('Max-Age=0'))).toBe(true);
        });

        it('legacy CSRF expiry has no Domain (expires host-only cookie)', () => {
            const { c, getHeaders } = makeContextStub();
            clearCustomerCookies(c, true);
            const csrfHeaders = getHeaders().filter((h) => h.startsWith(`${CSRF_COOKIE_NAME}=`));
            const legacy = csrfHeaders.find((h) => !h.includes('Domain='));
            expect(legacy).toBeTruthy();
            expect(legacy).toContain('Max-Age=0');
        });

        it('domain-scoped CSRF expiry carries Domain=dreamwebapp.com', () => {
            const { c, getHeaders } = makeContextStub();
            clearCustomerCookies(c, true);
            const csrfHeaders = getHeaders().filter((h) => h.startsWith(`${CSRF_COOKIE_NAME}=`));
            const scoped = csrfHeaders.find((h) => h.includes('Domain='));
            expect(scoped).toBeTruthy();
            expect(scoped).toContain('Domain=dreamwebapp.com');
            expect(scoped).toContain('Max-Age=0');
        });

        it('session cookie expiry is HttpOnly and has no Domain', () => {
            const { c, getHeaders } = makeContextStub();
            clearCustomerCookies(c, true);
            const session = getHeaders().find((h) => h.startsWith(`${SESSION_COOKIE_NAME}=`));
            expect(session).toContain('HttpOnly');
            expect(session).not.toContain('Domain=');
        });
    });
});

// ─── §3 · CORS preflight integration tests ────────────────────────────────────

describe('§3 · CORS preflight', () => {
    const corsEnv: Env = { ...BASE_ENV, DB: createInMemoryDB().db };

    it('reflects exact origin and credentials=true for a listed HTTPS origin', async () => {
        const res = await app.fetch(
            new Request('http://localhost/api/v1/auth/me', {
                method: 'OPTIONS',
                headers: {
                    Origin: 'https://dreamwebapp.com',
                    'Access-Control-Request-Method': 'GET',
                },
            }),
            corsEnv,
        );
        expect(res.status).toBe(204);
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://dreamwebapp.com');
        expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
        expect(res.headers.get('Vary')).toContain('Origin');
    });

    it('reflects www subdomain and credentials=true', async () => {
        const res = await app.fetch(
            new Request('http://localhost/api/v1/auth/me', {
                method: 'OPTIONS',
                headers: {
                    Origin: 'https://www.dreamwebapp.com',
                    'Access-Control-Request-Method': 'GET',
                },
            }),
            corsEnv,
        );
        expect(res.status).toBe(204);
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://www.dreamwebapp.com');
        expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('grants zero CORS authorization for an untrusted origin', async () => {
        const res = await app.fetch(
            new Request('http://localhost/api/v1/auth/me', {
                method: 'OPTIONS',
                headers: {
                    Origin: 'https://malicious.com',
                    'Access-Control-Request-Method': 'POST',
                },
            }),
            corsEnv,
        );
        expect(res.status).toBe(204);
        expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    });
});

// ─── §4 · CSRF double-submit integration tests ───────────────────────────────

describe('§4 · CSRF double-submit on /email-verification/resend', () => {
    it('rejects POST without X-CSRF-Token header (returns 403 CSRF_VALIDATION_FAILED)', async () => {
        const db = createInMemoryDB().db;
        const env = { ...BASE_ENV, DB: db };
        const user = await registerCustomerWithPassword(createDB(db), {
            email: 'resend-no-token@example.com',
            password: 'Password123!',
        });

        const res = await app.fetch(
            new Request('http://localhost/api/v1/auth/email-verification/resend', {
                method: 'POST',
                headers: {
                    Origin: 'https://dreamwebapp.com',
                    Cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(user.sessionToken)}; ${CSRF_COOKIE_NAME}=${encodeURIComponent(user.csrfToken)}`,
                },
            }),
            env,
        );

        expect(res.status).toBe(403);
        const body = (await res.json()) as { code: string };
        expect(body.code).toBe('CSRF_VALIDATION_FAILED');
    });

    it('accepts POST with matching X-CSRF-Token header (returns 200)', async () => {
        const db = createInMemoryDB().db;
        const env = { ...BASE_ENV, DB: db };
        const user = await registerCustomerWithPassword(createDB(db), {
            email: 'resend-valid@example.com',
            password: 'Password123!',
        });

        // Stub Resend email provider to avoid real network call
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : String(input);
            if (url.includes('api.resend.com')) {
                return new Response(JSON.stringify({ id: 'mock_id' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return originalFetch(input, init);
        });

        try {
            const res = await app.fetch(
                new Request('http://localhost/api/v1/auth/email-verification/resend', {
                    method: 'POST',
                    headers: {
                        Origin: 'https://dreamwebapp.com',
                        Cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(user.sessionToken)}; ${CSRF_COOKIE_NAME}=${encodeURIComponent(user.csrfToken)}`,
                        'X-CSRF-Token': user.csrfToken,
                    },
                }),
                env,
            );
            expect(res.status).toBe(200);
            const body = (await res.json()) as { success: boolean };
            expect(body.success).toBe(true);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('login response in production emits domain-scoped CSRF cookie (no host-only)', async () => {
        const db = createInMemoryDB().db;
        const env = { ...BASE_ENV, DB: db };
        await registerCustomerWithPassword(createDB(db), {
            email: 'cookie-scope@example.com',
            password: 'Password123!',
        });

        const res = await app.fetch(
            new Request('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Origin: 'https://dreamwebapp.com' },
                body: JSON.stringify({ email: 'cookie-scope@example.com', password: 'Password123!' }),
            }),
            env,
        );
        expect(res.status).toBe(200);

        const setCookies = res.headers.getSetCookie();
        // In production: session + legacy-expiry + scoped-csrf = 3 directives
        expect(setCookies.length).toBe(3);

        const session = setCookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
        expect(session).toContain('HttpOnly');
        expect(session).not.toContain('Domain=');

        // The domain-scoped CSRF cookie must carry Domain= and be non-HttpOnly
        const scopedCsrf = setCookies.find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`) && c.includes('Domain='));
        expect(scopedCsrf).toBeTruthy();
        expect(scopedCsrf).not.toContain('HttpOnly');
        expect(scopedCsrf).toContain('Domain=dreamwebapp.com');

        // The legacy-expiry directive must have Max-Age=0 and no Domain
        const legacyExpiry = setCookies.find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`) && c.includes('Max-Age=0') && !c.includes('Domain='));
        expect(legacyExpiry).toBeTruthy();
    });
});
