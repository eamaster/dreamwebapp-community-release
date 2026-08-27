/**
 * JWT authentication middleware for admin routes.
 *
 * Uses the Web Crypto API (natively available in Cloudflare Workers) to
 * sign and verify HS256 JWTs — no external JWT library needed.
 *
 * Usage:
 *   app.use('/api/v1/admin/*', jwtMiddleware);
 */

import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import type { Env } from '../types/env';
import { createDB } from '../db';
import * as schema from '../db/schema';

export type HonoVariables = {
    jwtPayload: JWTPayload;
};

// ─── JWT Helpers ─────────────────────────────────────────────────────────────

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };

export function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function base64UrlDecode(str: string): Uint8Array {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? 0 : 4 - (padded.length % 4);
    return Uint8Array.from(atob(padded + '='.repeat(pad)), (c) => c.charCodeAt(0));
}

async function importKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        ALGORITHM,
        false,
        ['sign', 'verify']
    );
}

export interface JWTPayload {
    sub: string;   // admin user id
    email: string;
    role: string;
    iat: number;
    exp: number;
    /**
     * Token version at the time this JWT was signed, compared against the
     * account's current `token_version` on every request. Optional so
     * tokens signed before this field existed keep working (unchecked)
     * until they naturally expire — see jwtMiddleware.
     */
    tv?: number;
}

/**
 * Sign a JWT payload with HS256.
 */
export async function signJWT(payload: JWTPayload, secret: string): Promise<string> {
    const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
    const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    const data = `${header}.${body}`;

    const key = await importKey(secret);
    const sig = await crypto.subtle.sign(ALGORITHM, key, new TextEncoder().encode(data));

    return `${data}.${base64UrlEncode(sig)}`;
}

/**
 * Verify a JWT and return the payload. Throws on invalid/expired token.
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token structure');

    const [header, body, signature] = parts as [string, string, string];
    const data = `${header}.${body}`;

    const key = await importKey(secret);
    const valid = await crypto.subtle.verify(
        ALGORITHM,
        key,
        base64UrlDecode(signature),
        new TextEncoder().encode(data)
    );

    if (!valid) throw new Error('Invalid signature');

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as JWTPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
    }

    return payload;
}

// ─── Hono Middleware ─────────────────────────────────────────────────────────

/**
 * JWT middleware — attaches validated payload to `c.set('jwtPayload', payload)`.
 * Returns 401 on missing/invalid tokens and 403 on insufficient role.
 */
export async function jwtMiddleware(c: Context<{ Bindings: Env; Variables: HonoVariables }>, next: Next) {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or malformed Authorization header' }, 401);
    }

    const token = authHeader.slice(7);

    try {
        const payload = await verifyJWT(token, c.env.JWT_SECRET);

        // Ensure token belongs to an admin role and is not a customer token
        if (!payload.role || !['super_admin', 'editor'].includes(payload.role) || (payload as unknown as Record<string, unknown>)['type'] === 'customer') {
            return c.json({ error: 'Access denied. Administrator privileges required.' }, 403);
        }

        // Tokens signed with a `tv` claim must still match the account's
        // current token_version — bumped on password reset / verified email
        // change to invalidate every previously issued session. Tokens
        // signed before this claim existed are left unchecked so currently
        // logged-in admins aren't logged out by this change; they simply
        // expire normally (8h) and re-authenticate into the new format.
        if (typeof payload.tv === 'number') {
            const db = createDB(c.env.DB);
            const user = await db
                .select({ tokenVersion: schema.adminUsers.tokenVersion })
                .from(schema.adminUsers)
                .where(eq(schema.adminUsers.id, Number(payload.sub)))
                .limit(1)
                .then((rows) => rows[0]);

            if (!user || user.tokenVersion !== payload.tv) {
                return c.json({ error: 'Session expired. Please sign in again.' }, 401);
            }
        }

        c.set('jwtPayload', payload);
        await next();
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        return c.json({ error: message }, 401);
    }
}

// ─── Password Hashing (Web Crypto PBKDF2) ────────────────────────────────────

/**
 * Hash a password using PBKDF2-SHA256 (Web Crypto safe for Workers).
 * Returns a storable string: `pbkdf2:iterations:base64(salt):base64(hash)`
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iterations = 100_000;

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const hashBuffer = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
        keyMaterial,
        256
    );

    const saltB64 = btoa(String.fromCharCode(...salt));
    const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

    return `pbkdf2:${iterations}:${saltB64}:${hashB64}`;
}

/**
 * Verify a password against a stored PBKDF2 hash string.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split(':');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

    const iterations = parseInt(parts[1] ?? '0', 10);
    const salt = Uint8Array.from(atob(parts[2] ?? ''), (c) => c.charCodeAt(0));
    const expectedHash = Uint8Array.from(atob(parts[3] ?? ''), (c) => c.charCodeAt(0));

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const derivedBuffer = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
        keyMaterial,
        256
    );

    const derived = new Uint8Array(derivedBuffer);

    // Constant-time comparison
    if (derived.length !== expectedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < derived.length; i++) {
        diff |= (derived[i] ?? 0) ^ (expectedHash[i] ?? 0);
    }
    return diff === 0;
}
