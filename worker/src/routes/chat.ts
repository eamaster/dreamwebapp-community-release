/**
 * AI Chat route — POST /api/v1/chat
 *
 * A narrow, sales/support-only chatbot MVP. Flow:
 *   1. KV sliding-window rate limit (per IP)
 *   2. Zod validation of a bounded message array
 *   3. Deterministic "talk to a human" intent detection (no AI call needed)
 *   4. Otherwise: build a knowledge context from approved public content
 *      (site/services/solutions/pricing/faq) and call the AI provider
 *   5. Normalize any provider failure into a safe, honest fallback message
 *
 * Never caches personalized replies (explicit no-store header).
 * Never exposes provider errors, stack traces, or env values to the client.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { HonoVariables } from '../middleware/auth';
import { ChatRequestSchema } from '../validators/schemas';
import { rateLimiter } from '../middleware/ratelimit';
import { CACHE_CONTROL } from '../middleware/cache';
import { buildKnowledgeContext } from '../lib/knowledge';
import { generateAssistantReply, type AiChatMessage } from '../lib/ai-provider';
import { buildSystemPrompt, isHandoffIntent, HANDOFF_REPLY_MESSAGE, AI_UNAVAILABLE_MESSAGE } from '../lib/prompt';

export const chatRouter = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// Generous but bounded: conversational back-and-forth, not a lead form.
chatRouter.use('/*', rateLimiter(20, 10 * 60 * 1000, 'rl:chat'));

interface ChatAction {
    type: 'handoff' | 'contact';
    label: string;
    path: string;
}

interface ChatSuccessResponse {
    success: true;
    reply: string;
    action?: ChatAction;
    degraded?: boolean;
}

const HANDOFF_ACTION: ChatAction = { type: 'handoff', label: 'Talk to a person', path: '/contact' };
const CONTACT_ACTION: ChatAction = { type: 'contact', label: 'Contact us', path: '/contact' };

chatRouter.post('/', async (c) => {
    // ── Parse body ────────────────────────────────────────────────────────────
    let rawBody: unknown;
    try {
        rawBody = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    // ── Validate ─────────────────────────────────────────────────────────────
    const parsed = ChatRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        return c.json({ error: 'Validation failed', fields: fieldErrors }, 422);
    }

    const { messages } = parsed.data;
    const lastMessage = messages[messages.length - 1];

    c.header('Cache-Control', CACHE_CONTROL.NO_STORE);

    // ── Deterministic human handoff (no AI call, always correct) ─────────────
    if (lastMessage && isHandoffIntent(lastMessage.content)) {
        const body: ChatSuccessResponse = {
            success: true,
            reply: HANDOFF_REPLY_MESSAGE,
            action: HANDOFF_ACTION,
        };
        return c.json(body, 200);
    }

    // ── Grounded AI reply ──────────────────────────────────────────────────────
    try {
        const knowledge = await buildKnowledgeContext(c.env);
        const systemPrompt = buildSystemPrompt(knowledge);

        const providerMessages: AiChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content }) satisfies AiChatMessage),
        ];

        const result = await generateAssistantReply(c.env, providerMessages);

        if (!result.ok) {
            const body: ChatSuccessResponse = {
                success: true,
                reply: AI_UNAVAILABLE_MESSAGE,
                action: CONTACT_ACTION,
                degraded: true,
            };
            return c.json(body, 200);
        }

        // Bound the reply length defensively regardless of model behavior.
        const reply = result.text.length > 1500 ? `${result.text.slice(0, 1500)}…` : result.text;
        const body: ChatSuccessResponse = { success: true, reply };
        return c.json(body, 200);
    } catch (err) {
        console.error('[chat] handler error:', err instanceof Error ? err.message : 'unknown error');
        const body: ChatSuccessResponse = {
            success: true,
            reply: AI_UNAVAILABLE_MESSAGE,
            action: CONTACT_ACTION,
            degraded: true,
        };
        return c.json(body, 200);
    }
});
