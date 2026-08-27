/**
 * AI provider adapter.
 *
 * Routes are decoupled from any specific vendor SDK — they call
 * `generateAssistantReply()` and only ever see the small `AiProviderResult`
 * union below. The current implementation uses Cloudflare Workers AI (the
 * `AI` binding declared in `wrangler.jsonc`), which requires no API key or
 * secret: it is authenticated by the Worker's own Cloudflare account.
 *
 * If a different provider is ever needed, only this file changes — the
 * route and prompt-building code are provider-agnostic.
 */

import type { Env } from '../types/env';

export interface AiChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export type AiProviderResult =
    | { ok: true; text: string }
    | { ok: false; reason: 'not_configured' | 'timeout' | 'provider_error' };

/** Small, fast instruction-tuned model — good fit for concise sales/support replies. */
const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_TOKENS = 350;

/**
 * Generate an assistant reply for the given conversation.
 * Never throws — all failure modes resolve to a typed `{ ok: false, reason }`
 * so callers can fall back to a deterministic, user-safe message.
 */
export async function generateAssistantReply(
    env: Env,
    messages: AiChatMessage[]
): Promise<AiProviderResult> {
    if (!env.AI) {
        return { ok: false, reason: 'not_configured' };
    }

    // Tracked so the deadline timer can be cleared as soon as the provider
    // settles — otherwise the timer keeps a handle alive for the full
    // REQUEST_TIMEOUT_MS even when the provider answers in, say, 200ms.
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeout = new Promise<AiProviderResult>((resolve) => {
        timeoutHandle = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), REQUEST_TIMEOUT_MS);
    });

    const attempt = (async (): Promise<AiProviderResult> => {
        try {
            const result = await env.AI.run(MODEL, {
                messages,
                max_tokens: MAX_OUTPUT_TOKENS,
                temperature: 0.4,
            });

            const text = (result.response ?? '').trim();
            if (!text) {
                return { ok: false, reason: 'provider_error' };
            }
            return { ok: true, text };
        } catch (err) {
            // Never log message content — only a short diagnostic label.
            console.error('[chat] AI provider request failed:', err instanceof Error ? err.message : 'unknown error');
            return { ok: false, reason: 'provider_error' };
        }
    })();

    try {
        return await Promise.race([attempt, timeout]);
    } finally {
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
}
