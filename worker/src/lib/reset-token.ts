/**
 * Secure token generation/hashing for the admin password-reset flow.
 *
 * The raw token is only ever held in memory long enough to email it to the
 * account holder and is never persisted. Only a SHA-256 digest of the token
 * is stored, so a database read alone can never reveal a usable token.
 */

import { base64UrlEncode } from '../middleware/auth';

/** Generates a random, high-entropy, URL-safe token and its storable digest. */
export async function generateResetToken(): Promise<{ token: string; tokenHash: string }> {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = base64UrlEncode(bytes.buffer as ArrayBuffer);
    const tokenHash = await sha256Hex(token);
    return { token, tokenHash };
}

/** Hashes a raw token the same way for lookup against stored digests. */
export async function hashResetToken(token: string): Promise<string> {
    return sha256Hex(token);
}

async function sha256Hex(value: string): Promise<string> {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
