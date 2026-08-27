/**
 * KV-backed sliding-window rate limiter.
 *
 * Strategy: Each IP gets a KV key `rl:{ip}:{endpoint}`.
 * The value stores `{ count: number; windowStart: number }` (JSON).
 * If `windowStart` is older than `windowMs`, the window resets.
 * If `count >= limit`, return 429 with Retry-After header.
 *
 * Limitations: KV consistency is eventually consistent across regions,
 * making this suitable for soft limits (anti-spam) not hard security controls.
 * For hard limits, use Durable Objects instead.
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types/env';
import type { HonoVariables } from './auth';
import { KV_TTL } from './cache';

interface RateLimitRecord {
    count: number;
    windowStart: number; // Unix timestamp ms
}

/**
 * Build a Hono middleware for rate limiting a specific endpoint.
 *
 * @param limit     Max requests allowed per window
 * @param windowMs  Window duration in milliseconds (default: 15 min)
 * @param keyPrefix KV key prefix (default: 'rl')
 */
export function rateLimiter(
    limit: number = 5,
    windowMs: number = 15 * 60 * 1000,
    keyPrefix: string = 'rl'
) {
    return async function rateLimit(c: Context<{ Bindings: Env; Variables: HonoVariables }>, next: Next) {
        // Prefer CF-Connecting-IP (set by Cloudflare) over X-Forwarded-For
        const ip =
            c.req.header('CF-Connecting-IP') ??
            c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
            'unknown';

        const endpoint = new URL(c.req.url).pathname;
        const kvKey = `${keyPrefix}:${ip}:${endpoint}`;
        const now = Date.now();

        let record: RateLimitRecord = { count: 0, windowStart: now };

        try {
            const raw = await c.env.CONTENT_KV.get(kvKey, 'text');
            if (raw) {
                const stored = JSON.parse(raw) as RateLimitRecord;
                // If within the same window, keep accumulated count
                if (now - stored.windowStart < windowMs) {
                    record = stored;
                }
                // Otherwise window has expired → record resets (stays at default)
            }
        } catch {
            // On KV error, allow the request (fail-open to avoid user-facing 500s)
        }

        record.count += 1;

        // Persist updated record — TTL aligns with remaining window
        const remainingWindowSec = Math.ceil(
            (windowMs - (now - record.windowStart)) / 1000
        );

        try {
            await c.env.CONTENT_KV.put(kvKey, JSON.stringify(record), {
                expirationTtl: Math.max(remainingWindowSec, KV_TTL.RATE_LIMIT),
            });
        } catch {
            // Non-fatal
        }

        if (record.count > limit) {
            const retryAfterSec = Math.ceil(remainingWindowSec);
            c.header('Retry-After', String(retryAfterSec));
            c.header('X-RateLimit-Limit', String(limit));
            c.header('X-RateLimit-Remaining', '0');
            c.header('X-RateLimit-Reset', String(Math.floor((record.windowStart + windowMs) / 1000)));

            return c.json(
                {
                    error: 'Too many requests. Please wait before submitting again.',
                    retryAfter: retryAfterSec,
                },
                429
            );
        }

        c.header('X-RateLimit-Limit', String(limit));
        c.header('X-RateLimit-Remaining', String(Math.max(0, limit - record.count)));

        await next();
    };
}
