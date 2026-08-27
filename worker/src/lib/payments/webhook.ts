/**
 * NOWPayments IPN (Instant Payment Notification) signature verification.
 *
 * The algorithm required by NOWPayments:
 *   1. Recursively sort all JSON object keys alphabetically.
 *   2. Serialize to compact JSON.
 *   3. Compute HMAC-SHA512 using the IPN secret.
 *   4. Compare with the `x-nowpayments-sig` header using a timing-safe comparison.
 *
 * Reference: https://documenter.getpostman.com/view/7907941/2s93JqTRst#ipn
 */

/**
 * Recursively sorts the keys of a plain object (and any nested objects)
 * in alphabetical order. Arrays are not sorted — only their elements are
 * processed recursively if they are objects.
 *
 * Exported for unit-test coverage.
 */
export function sortKeysRecursive(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sortKeysRecursive);
    }
    if (value !== null && typeof value === 'object') {
        const sorted: Record<string, unknown> = {};
        for (const key of Object.keys(value as Record<string, unknown>).sort()) {
            sorted[key] = sortKeysRecursive((value as Record<string, unknown>)[key]);
        }
        return sorted;
    }
    return value;
}

/**
 * Computes HMAC-SHA512 of `message` with `secret` using the Web Crypto API
 * (available in Cloudflare Workers).
 *
 * Returns the digest as a lowercase hex string.
 */
async function hmacSha512Hex(secret: string, message: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Timing-safe string comparison using XOR over UTF-8 bytes.
 * Returns true only if both strings are equal in length and content.
 */
function timingSafeEqual(a: string, b: string): boolean {
    const enc = new TextEncoder();
    const aBytes = enc.encode(a);
    const bBytes = enc.encode(b);
    // Length check must not short-circuit (compare all bytes)
    if (aBytes.length !== bBytes.length) return false;
    let diff = 0;
    for (let i = 0; i < aBytes.length; i++) {
        diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
    }
    return diff === 0;
}

/**
 * Verifies an NOWPayments IPN signature.
 *
 * @param rawBody   The raw JSON string from the request body (read once, before parsing).
 * @param signature The value of the `x-nowpayments-sig` request header.
 * @param secret    The `NOWPAYMENTS_IPN_SECRET` from Worker env. NEVER log this value.
 * @returns         `true` if the signature is valid, `false` otherwise.
 */
export async function verifyIpnSignature(
    rawBody: string,
    signature: string,
    secret: string,
): Promise<boolean> {
    // Parse the raw body and re-serialize with sorted keys (as NOWPayments specifies)
    let parsed: unknown;
    try {
        parsed = JSON.parse(rawBody);
    } catch {
        return false;
    }

    const sortedBody = JSON.stringify(sortKeysRecursive(parsed));
    const expected = await hmacSha512Hex(secret, sortedBody);
    return timingSafeEqual(expected, signature.toLowerCase());
}

/**
 * Computes a SHA-256 hex digest of the given string.
 * Used to generate the event_fingerprint and payload_hash without storing raw payloads.
 */
export async function sha256Hex(input: string): Promise<string> {
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(input));
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
