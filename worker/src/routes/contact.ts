/**
 * Lead Capture route — POST /api/v1/contact
 *
 * Flow:
 *   1. KV sliding-window rate limit (5 req / 15 min per IP)
 *   2. Zod validation
 *   3. Insert into D1 `contact_messages`
 *   4. Return 201 with the new message id
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { HonoVariables } from '../middleware/auth';
import { createDB } from '../db';
import * as schema from '../db/schema';
import { ContactSubmissionSchema } from '../validators/schemas';
import { rateLimiter } from '../middleware/ratelimit';
import { CACHE_CONTROL } from '../middleware/cache';

export const contactRouter = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// Apply rate limiting: 5 submissions per 15 minutes per IP
contactRouter.use('/*', rateLimiter(5, 15 * 60 * 1000, 'rl:contact'));

contactRouter.post('/', async (c) => {
    // ── Parse body ──────────────────────────────────────────────────────────
    let rawBody: unknown;
    try {
        rawBody = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    // ── Validate ─────────────────────────────────────────────────────────────
    const parsed = ContactSubmissionSchema.safeParse(rawBody);
    if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        return c.json(
            {
                error: 'Validation failed',
                fields: fieldErrors,
            },
            422
        );
    }

    const { name, email, businessType, website, phone, message, source } = parsed.data;

    // ── Fold chat-handoff metadata into the message body ──────────────────────
    // The DB schema does not have a dedicated "source" column — rather than add
    // a migration for a single label, the smallest compatible extension is to
    // prefix the stored message when the lead originated from the AI chat
    // widget. The chat widget already prefills the visitor-edited conversation
    // summary directly into `message`, so no raw transcript is ever received here.
    const storedMessage = source === 'chatbot' ? `[Handoff requested from AI Chatbot]\n\n${message}` : message;

    // ── Capture IP for audit trail ─────────────────────────────────────────────
    const ipAddress =
        c.req.header('CF-Connecting-IP') ??
        c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
        null;

    // ── Insert into D1 ───────────────────────────────────────────────────────
    const db = createDB(c.env.DB);

    let insertedId: number;
    try {
        const result = await db
            .insert(schema.contactMessages)
            .values({
                name,
                email,
                businessType,
                website: website ?? null,
                phone: phone ?? null,
                message: storedMessage,
                ipAddress,
                status: 'unread',
            })
            .returning({ id: schema.contactMessages.id });

        const row = result[0];
        if (!row) throw new Error('No row returned');
        insertedId = row.id;
    } catch (err) {
        console.error('[contact] D1 insert failed:', err);
        return c.json({ error: 'Failed to save your message. Please try again.' }, 500);
    }

    // ── Respond ──────────────────────────────────────────────────────────────
    c.header('Cache-Control', CACHE_CONTROL.NO_STORE);
    return c.json(
        {
            success: true,
            id: insertedId,
            message: "Thank you! We'll be in touch within 24 hours.",
        },
        201
    );
});
