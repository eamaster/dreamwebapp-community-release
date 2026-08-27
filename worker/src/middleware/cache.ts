/**
 * KV Cache helpers — two-tier caching layer.
 *
 * Read flow:
 *   1. Cloudflare Edge Cache (via Cache-Control response headers) — handled at network level
 *   2. KV lookup (this module)
 *   3. D1 query (callers responsibility)
 *
 * Write flow:
 *   KV is set after every D1 read, and purged on every admin write.
 */

// ─── KV Key Constants ─────────────────────────────────────────────────────────

export const KV_KEYS = {
    SITE: 'content:site',
    SERVICES: 'content:services',
    SOLUTIONS: 'content:solutions',
    PRICING: 'content:pricing',
    FAQ: 'content:faq',
} as const;

export type KVKey = (typeof KV_KEYS)[keyof typeof KV_KEYS];

// ─── KV TTLs (in seconds) ─────────────────────────────────────────────────────

export const KV_TTL = {
    CONTENT: 3600,       // 1 hour — public content
    RATE_LIMIT: 900,     // 15 minutes — rate limit windows
} as const;

// ─── Cache-Control header values ─────────────────────────────────────────────

export const CACHE_CONTROL = {
    /** Public content — short CDN edge cache (60s) with browser cache (5min).
     *  s-maxage=60 ensures CDN picks up KV-invalidated content within 60s.
     *  stale-while-revalidate keeps UX snappy while the CDN revalidates. */
    PUBLIC_CONTENT: 'public, max-age=300, s-maxage=60, stale-while-revalidate=120',
    /** No caching — admin/write endpoints */
    NO_STORE: 'no-store, no-cache, must-revalidate',
} as const;

// ─── KV Read ──────────────────────────────────────────────────────────────────

/**
 * Attempt to read a JSON-serialized value from KV.
 * Returns the parsed value or null on miss/parse-error.
 */
export async function kvGet<T>(kv: KVNamespace, key: string): Promise<T | null> {
    try {
        const raw = await kv.get(key, 'text');
        if (!raw) return null;
        return JSON.parse(raw) as T;
    } catch {
        // Treat stale/corrupt entries as cache miss
        return null;
    }
}

// ─── KV Write ─────────────────────────────────────────────────────────────────

/**
 * Serialize `data` to JSON and store in KV with the given TTL (seconds).
 * Failures are intentionally swallowed — KV write errors must not break reads.
 */
export async function kvSet(
    kv: KVNamespace,
    key: string,
    data: unknown,
    ttlSeconds: number = KV_TTL.CONTENT
): Promise<void> {
    try {
        await kv.put(key, JSON.stringify(data), {
            expirationTtl: ttlSeconds,
        });
    } catch {
        // Non-fatal: next request will re-query D1
    }
}

// ─── KV Invalidate ────────────────────────────────────────────────────────────

/**
 * Delete one or more KV keys (cache invalidation after admin writes).
 * All deletes run in parallel; individual failures are logged but do not throw.
 */
export async function kvInvalidate(kv: KVNamespace, ...keys: string[]): Promise<void> {
    await Promise.allSettled(keys.map((key) => kv.delete(key)));
}
