/**
 * Customer authentication & CSRF middleware.
 *
 * Enforces HttpOnly cookie sessions, server-side revocation in D1,
 * double-submit CSRF protection on state-changing requests, and strict Origin verification.
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types/env';
import { createDB } from '../db';
import { validateCustomerSession, SESSION_EXPIRY_DAYS } from '../lib/customer-auth-service';
import type { UserRow } from '../db/schema';

export interface CustomerPrincipal {
    userId: string;
    email: string | null;
}

export type CustomerHonoVariables = {
    customer?: CustomerPrincipal;
    customerUser?: UserRow;
};

export const SESSION_COOKIE_NAME = 'dreamwebapp_session';
export const CSRF_COOKIE_NAME = 'dreamwebapp_csrf';

/**
 * Extracts a cookie value by name from the Cookie header.
 * Returns the FIRST match (browsers send more-specific/host-only cookies first).
 */
export function getCookie(c: Context, name: string): string | null {
    const cookieHeader = c.req.header('Cookie');
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const [k, ...v] = cookie.trim().split('=');
        if (k === name) {
            return decodeURIComponent(v.join('='));
        }
    }
    return null;
}

/**
 * Validates and normalizes the shared cookie domain.
 *
 * In local/development environments: returns undefined so no Domain attribute is set,
 * keeping cookies host-only on localhost (correct per RFC 6265).
 *
 * In production:
 * - COOKIE_DOMAIN is required. Throws with an operational error if absent.
 * - Validates strict format: plain DNS label, no scheme, port, path, query, fragment,
 *   credentials, or IP address.
 * - Cross-validates that every HTTPS origin in CORS_ORIGIN is either equal to
 *   https://{COOKIE_DOMAIN} or ends with .{COOKIE_DOMAIN}, ensuring the configured
 *   shared domain is the true shared parent of all approved frontend origins.
 * - Throws on any validation failure; never leaks the bad value to the browser.
 */
export function getValidatedCookieDomain(env: Partial<Env>): string | undefined {
    const isProduction = env.ENVIRONMENT === 'production';
    if (!isProduction) {
        return undefined; // Local / dev environments: omit Domain attribute
    }

    const raw = env.COOKIE_DOMAIN;
    if (!raw || !raw.trim()) {
        throw new Error('[customer-auth] COOKIE_DOMAIN is required in production but is not set.');
    }

    const trimmed = raw.trim().replace(/^\./, '').toLowerCase();

    // Strict format: plain DNS hostname only, no scheme, port, path, query, fragment, credentials
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(trimmed)) {
        throw new Error('[customer-auth] COOKIE_DOMAIN must be a plain DNS domain (no scheme, port, path, query, or IP).');
    }

    // Must have at least one dot (reject public-suffix-only values like "com", "co.uk")
    if (!trimmed.includes('.')) {
        throw new Error('[customer-auth] COOKIE_DOMAIN must be at least a second-level domain.');
    }

    // Cross-validate against configured CORS_ORIGIN:
    // Every HTTPS origin in CORS_ORIGIN must be a subdomain of or equal to COOKIE_DOMAIN.
    const corsOrigins = (env.CORS_ORIGIN ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

    const httpsOrigins = corsOrigins.filter((o) => o.startsWith('https://'));
    for (const origin of httpsOrigins) {
        let hostname: string;
        try {
            hostname = new URL(origin).hostname.toLowerCase();
        } catch {
            throw new Error('[customer-auth] CORS_ORIGIN contains an invalid URL.');
        }
        if (hostname !== trimmed && !hostname.endsWith(`.${trimmed}`)) {
            throw new Error(
                `[customer-auth] COOKIE_DOMAIN is not a shared parent of all approved HTTPS origins.`
            );
        }
    }

    return trimmed;
}

/**
 * Sets customer session and CSRF cookies on the response.
 *
 * Cookie architecture:
 * 1. Session cookie: HttpOnly, Secure in production, SameSite=Lax.
 *    No Domain attribute → host-only to api.dreamwebapp.com. Least privilege.
 *
 * 2. Legacy CSRF expiration: Max-Age=0, no Domain.
 *    Expires any pre-existing host-only dreamwebapp_csrf cookie at api.dreamwebapp.com
 *    that may have been set by a prior Worker version before domain-scoping was added.
 *    This is permanently harmless when no legacy cookie exists.
 *
 * 3. Domain-scoped CSRF cookie: non-HttpOnly (JS-readable), Secure in production,
 *    SameSite=Lax, Domain={COOKIE_DOMAIN} so frontend JS on the shared parent domain
 *    can read and double-submit it as X-CSRF-Token.
 */
export function setCustomerCookies(
    c: Context,
    sessionToken: string,
    csrfToken: string,
    isProduction = true,
) {
    const maxAge = SESSION_EXPIRY_DAYS * 24 * 60 * 60;
    const secureFlag = isProduction ? '; Secure' : '';
    const cookieDomain = getValidatedCookieDomain((c.env as unknown as Partial<Env>) || {});
    const domainFlag = cookieDomain ? `; Domain=${cookieDomain}` : '';

    // 1. Session cookie (HttpOnly, host-scoped to API for least privilege)
    c.header(
        'Set-Cookie',
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secureFlag}`,
        { append: true },
    );

    // 2. Expire legacy host-only CSRF cookie (if it existed from a pre-domain-scoping Worker version).
    //    Permanently safe to emit even when no legacy cookie exists.
    if (cookieDomain) {
        c.header(
            'Set-Cookie',
            `${CSRF_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`,
            { append: true },
        );
    }

    // 3. Issue the current domain-scoped CSRF cookie (JS-readable for X-CSRF-Token double-submit)
    c.header(
        'Set-Cookie',
        `${CSRF_COOKIE_NAME}=${encodeURIComponent(csrfToken)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureFlag}${domainFlag}`,
        { append: true },
    );
}

/**
 * Clears customer session and CSRF cookies on logout or session expiry.
 *
 * Expires both:
 * - The host-only session cookie.
 * - The legacy host-only CSRF cookie (Max-Age=0, no Domain).
 * - The current domain-scoped CSRF cookie (Max-Age=0, with Domain).
 *
 * Attributes must match the originating Set-Cookie to correctly invalidate each scope.
 */
export function clearCustomerCookies(c: Context, isProduction = true) {
    const secureFlag = isProduction ? '; Secure' : '';
    const cookieDomain = getValidatedCookieDomain((c.env as unknown as Partial<Env>) || {});
    const domainFlag = cookieDomain ? `; Domain=${cookieDomain}` : '';

    // Session cookie (host-only)
    c.header(
        'Set-Cookie',
        `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureFlag}`,
        { append: true },
    );

    // Legacy host-only CSRF cookie (no Domain, for backward-compat expiration)
    if (cookieDomain) {
        c.header(
            'Set-Cookie',
            `${CSRF_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`,
            { append: true },
        );
    }

    // Current domain-scoped CSRF cookie
    c.header(
        'Set-Cookie',
        `${CSRF_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secureFlag}${domainFlag}`,
        { append: true },
    );
}

/**
 * Validates request Origin against allowlisted CORS_ORIGIN for defense-in-depth.
 */
export function isOriginAllowed(c: Context): boolean {
    const origin = c.req.header('Origin');
    if (!origin) return true; // Non-browser / same-origin GET without Origin header

    const corsOrigin = (c.env as unknown as Record<string, unknown>)?.['CORS_ORIGIN'];
    const allowedOrigins = typeof corsOrigin === 'string'
        ? corsOrigin.split(',').map((o) => o.trim()).filter(Boolean)
        : [];

    if (allowedOrigins.length === 0) return true;
    return allowedOrigins.includes(origin);
}

/**
 * Middleware: Enforces customer session and CSRF verification.
 */
export async function customerAuthMiddleware(
    c: Context<{ Bindings: Env; Variables: CustomerHonoVariables }>,
    next: Next,
) {
    // 1. Validate Origin on state-changing requests
    const method = c.req.method.toUpperCase();
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

    if (isStateChanging && !isOriginAllowed(c)) {
        return c.json({ error: 'Untrusted origin', code: 'UNTRUSTED_ORIGIN' }, 403);
    }

    // 2. Validate Session Cookie
    const rawSession = getCookie(c, SESSION_COOKIE_NAME);
    if (!rawSession) {
        return c.json({ error: 'Authentication required. Please sign in.', code: 'UNAUTHORIZED' }, 401);
    }

    const db = createDB(c.env.DB);
    const sessionResult = await validateCustomerSession(db, rawSession);

    if (!sessionResult) {
        clearCustomerCookies(c, c.env.ENVIRONMENT === 'production');
        return c.json({ error: 'Session expired. Please sign in again.', code: 'SESSION_EXPIRED' }, 401);
    }

    // 3. Double-Submit CSRF check on state-changing requests
    if (isStateChanging) {
        const csrfCookie = getCookie(c, CSRF_COOKIE_NAME);
        const csrfHeader = c.req.header('X-CSRF-Token');

        if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
            return c.json({ error: 'Invalid or missing CSRF token', code: 'CSRF_VALIDATION_FAILED' }, 403);
        }
    }

    // 4. CSRF cookie migration: on every successful authenticated response in production,
    //    re-emit the domain-scoped CSRF cookie (and legacy host-only expiry).
    //    This transparently migrates sessions created before domain-scoping was added
    //    without requiring re-login. Safe to emit on every request — value unchanged.
    const cookieDomain = getValidatedCookieDomain((c.env as unknown as Partial<Env>) || {});
    if (cookieDomain) {
        const existingCsrf = getCookie(c, CSRF_COOKIE_NAME);
        if (existingCsrf) {
            const isProduction = c.env.ENVIRONMENT === 'production';
            const secureFlag = isProduction ? '; Secure' : '';
            const maxAge = SESSION_EXPIRY_DAYS * 24 * 60 * 60;
            // Expire legacy host-only CSRF cookie at the API origin
            c.header(
                'Set-Cookie',
                `${CSRF_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`,
                { append: true },
            );
            // Re-issue as domain-scoped so the frontend JS on the shared parent domain can read it
            c.header(
                'Set-Cookie',
                `${CSRF_COOKIE_NAME}=${encodeURIComponent(existingCsrf)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureFlag}; Domain=${cookieDomain}`,
                { append: true },
            );
        }
    }

    c.set('customer', {
        userId: sessionResult.user.id,
        email: sessionResult.user.email,
    });
    c.set('customerUser', sessionResult.user);

    await next();
}


/**
 * Middleware: Optionally extracts customer principal if session is present (used for checkout).
 */
export async function optionalCustomerAuthMiddleware(
    c: Context<{ Bindings: Env; Variables: CustomerHonoVariables }>,
    next: Next,
) {
    const rawSession = getCookie(c, SESSION_COOKIE_NAME);
    if (rawSession) {
        try {
            const db = createDB(c.env.DB);
            const sessionResult = await validateCustomerSession(db, rawSession);
            if (sessionResult) {
                c.set('customer', {
                    userId: sessionResult.user.id,
                    email: sessionResult.user.email,
                });
                c.set('customerUser', sessionResult.user);
            }
        } catch {
            // Ignore error for optional session extraction
        }
    }

    await next();
}
