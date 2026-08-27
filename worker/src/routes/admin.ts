/**
 * Admin CMS API routes — /api/v1/admin/*
 *
 * All routes (except POST /auth/login) require a valid JWT Bearer token.
 * After each write (POST/PUT/DELETE), the relevant KV cache keys are purged
 * so the next public GET rebuilds from fresh D1 data.
 *
 * Routes:
 *   POST   /admin/auth/login              — get JWT token
 *   POST   /admin/auth/request-reset      — request a password-reset email (public, generic response)
 *   POST   /admin/auth/reset-password     — consume a reset token, set new password (public)
 *   POST   /admin/account/change-email/request — request an email-change verification link (requires JWT + current password)
 *   POST   /admin/account/change-email/confirm — consume the verification link, commit the new email (public)
 *
 *   GET    /admin/contacts                — list messages (paginated, filterable)
 *   PUT    /admin/contacts/:id            — update status
 *
 *   GET    /admin/services                — list all services (incl inactive)
 *   POST   /admin/services                — create service
 *   PUT    /admin/services/:id            — update service
 *   DELETE /admin/services/:id            — delete service
 *
 *   GET    /admin/solutions               — list all solutions
 *   POST   /admin/solutions               — create solution
 *   PUT    /admin/solutions/:id           — update solution
 *   DELETE /admin/solutions/:id           — delete solution
 *
 *   GET    /admin/pricing/plans           — list all plans
 *   POST   /admin/pricing/plans           — create plan
 *   PUT    /admin/pricing/plans/:id       — update plan
 *   DELETE /admin/pricing/plans/:id       — delete plan
 *
 *   GET    /admin/pricing/addons          — list all addons
 *   POST   /admin/pricing/addons          — create addon
 *   PUT    /admin/pricing/addons/:id      — update addon
 *   DELETE /admin/pricing/addons/:id      — delete addon
 *
 *   GET    /admin/faq                     — list all FAQs
 *   POST   /admin/faq                     — create FAQ
 *   PUT    /admin/faq/:id                 — update FAQ
 *   DELETE /admin/faq/:id                 — delete FAQ
 *
 *   GET    /admin/site                    — get site settings
 *   PUT    /admin/site                    — update site settings
 *   GET    /admin/capabilities            — which optional integrations are configured (no secrets)
 *
 *   GET    /admin/legal                   — list legal pages (privacy-policy, terms-of-service)
 *   PUT    /admin/legal/:id               — update a legal page
 *
 *   POST   /admin/assets/logo?target=     — upload/replace a header|footer logo (requires R2 binding)
 *   DELETE /admin/assets/logo?target=     — remove a header|footer logo
 */

import { Hono } from 'hono';
import { eq, desc, sql, and } from 'drizzle-orm';
import type { Env } from '../types/env';
import type { HonoVariables } from '../middleware/auth';
import { createDB } from '../db';
import * as schema from '../db/schema';
import {
    AdminLoginSchema,
    UpdateContactStatusSchema,
    ServiceWriteSchema,
    SolutionWriteSchema,
    PricingPlanWriteSchema,
    PricingAddonWriteSchema,
    FAQWriteSchema,
    SiteSettingsWriteSchema,
    PaginationSchema,
    RequestPasswordResetSchema,
    ResetPasswordSchema,
    LegalPageWriteSchema,
    RequestEmailChangeSchema,
    ConfirmEmailChangeSchema,
    AdminPaymentOrdersQuerySchema,
    AdminCustomersQuerySchema,
} from '../validators/schemas';
import { getAdminPaymentOrders, getAdminPaymentOrderDetail, getAdminPaymentSummary } from '../lib/payments/repository';
import {
    getAdminCustomers,
    getAdminCustomerDetail,
    adminSetCustomerDisabled,
    verifyDatabaseSchema,
} from '../lib/admin-customer-service';
import { jwtMiddleware, signJWT, verifyPassword, hashPassword } from '../middleware/auth';
import { kvInvalidate, KV_KEYS, CACHE_CONTROL } from '../middleware/cache';
import { rateLimiter } from '../middleware/ratelimit';
import { generateResetToken, hashResetToken } from '../lib/reset-token';
import { sendPasswordResetEmail, sendEmailChangeVerificationEmail, isEmailProviderConfigured } from '../lib/email-provider';
import { getCanonicalAppOrigin } from '../lib/customer-auth-service';
import { normalizeSocialLinks } from '../lib/social-links';
import {
    validateLogoUpload,
    isLogoStorageConfigured,
    putLogoAsset,
    deleteLogoAssetFromStorage,
    assetUrl,
} from '../lib/media-assets';

// ─── Router ───────────────────────────────────────────────────────────────────

export const adminRouter = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// No-cache on all admin responses
adminRouter.use('/*', async (c, next) => {
    c.header('Cache-Control', CACHE_CONTROL.NO_STORE);
    await next();
});

// ── Helper: parse + validate request body ────────────────────────────────────

async function parseBody<T>(c: { req: { json: () => Promise<unknown> } }, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { flatten: () => { fieldErrors: Record<string, string[]> } } } }) {
    let raw: unknown;
    try { raw = await c.req.json(); } catch { return { ok: false as const, error: 'Invalid JSON body' }; }
    const result = schema.safeParse(raw);
    if (!result.success) {
        return { ok: false as const, error: result.error.flatten().fieldErrors };
    }
    return { ok: true as const, data: result.data };
}

function parseService(row: schema.ServiceRow) {
    return {
        id: row.id,
        name: row.name,
        shortDescription: row.shortDescription,
        longDescription: row.longDescription,
        icon: row.icon,
        timeline: row.timeline,
        whoItsFor: JSON.parse(row.whoItsForJson || '[]') as string[],
        included: JSON.parse(row.includedJson || '[]') as string[],
        pricing: JSON.parse(row.pricingJson || '{}') as { type: string; amount?: number; note?: string },
        sortOrder: row.sortOrder,
        isActive: row.isActive,
    };
}

function parseSolution(row: schema.SolutionRow) {
    return {
        id: row.id,
        title: row.title,
        icon: row.icon,
        description: row.description,
        ctaText: row.ctaText,
        pains: JSON.parse(row.painsJson || '[]') as string[],
        benefits: JSON.parse(row.benefitsJson || '[]') as string[],
        sortOrder: row.sortOrder,
        isActive: row.isActive,
    };
}

function parsePricingPlan(row: schema.PricingPlanRow) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        monthlyPrice: row.monthlyPrice,
        setupFee: row.setupFee,
        bestFor: row.bestFor,
        ctaText: row.ctaText,
        badge: row.badge,
        highlighted: row.isHighlighted,
        features: JSON.parse(row.featuresJson || '[]') as string[],
        sortOrder: row.sortOrder,
        isActive: row.isActive,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — POST /admin/auth/login  (public, no JWT required)
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.use('/auth/login', rateLimiter(10, 15 * 60 * 1000, 'rl:admin-login'));

adminRouter.post('/auth/login', async (c) => {
    const result = await parseBody(c, AdminLoginSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);

    const { email, password } = result.data;
    const db = createDB(c.env.DB);

    const user = await db
        .select()
        .from(schema.adminUsers)
        .where(eq(schema.adminUsers.email, email))
        .limit(1)
        .then((rows) => rows[0]);

    if (!user || !user.isActive) {
        // Constant-time response to prevent user enumeration
        return c.json({ error: 'Invalid credentials' }, 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

    // Update last login
    await db
        .update(schema.adminUsers)
        .set({ lastLoginAt: new Date().toISOString() })
        .where(eq(schema.adminUsers.id, user.id));

    const now = Math.floor(Date.now() / 1000);
    const token = await signJWT(
        {
            sub: String(user.id),
            email: user.email,
            role: user.role,
            iat: now,
            exp: now + 60 * 60 * 8, // 8-hour expiry
            tv: user.tokenVersion,
        },
        c.env.JWT_SECRET
    );

    return c.json({ token, expiresIn: 60 * 60 * 8 });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — Password Reset (public, no JWT required)
//
// POST /admin/auth/request-reset — always returns the same generic result,
// whether or not the email matches an account, to prevent enumeration.
// POST /admin/auth/reset-password — consumes a one-time, short-lived token.
// ─────────────────────────────────────────────────────────────────────────────

const GENERIC_RESET_MESSAGE = 'If that email is registered, a password reset link has been sent.';
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

adminRouter.use('/auth/request-reset', rateLimiter(5, 15 * 60 * 1000, 'rl:admin-reset-req'));

adminRouter.post('/auth/request-reset', async (c) => {
    const result = await parseBody(c, RequestPasswordResetSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);

    // Fail closed and honestly if outbound email isn't configured — never
    // claim a link was sent when it wasn't, and never expose a token/link.
    if (!isEmailProviderConfigured(c.env)) {
        return c.json(
            { error: 'Password reset is not available yet. Please contact the site administrator.' },
            503
        );
    }

    const { email } = result.data;
    const db = createDB(c.env.DB);

    const user = await db
        .select()
        .from(schema.adminUsers)
        .where(eq(schema.adminUsers.email, email))
        .limit(1)
        .then((rows) => rows[0]);

    if (user && user.isActive) {
        const { token, tokenHash } = await generateResetToken();
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

        await db.insert(schema.passwordResetTokens).values({
            adminUserId: user.id,
            tokenHash,
            expiresAt,
        });

        const origin = getCanonicalAppOrigin(c.env, c.req.header('origin'));
        const resetUrl = `${origin}/admin/reset-password?token=${token}`;

        // Best-effort — the generic response is identical regardless of outcome.
        await sendPasswordResetEmail(c.env, user.email, resetUrl);
    }

    return c.json({ success: true, message: GENERIC_RESET_MESSAGE });
});

adminRouter.use('/auth/reset-password', rateLimiter(8, 15 * 60 * 1000, 'rl:admin-reset-confirm'));

adminRouter.post('/auth/reset-password', async (c) => {
    const result = await parseBody(c, ResetPasswordSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const { token, newPassword } = result.data;

    const tokenHash = await hashResetToken(token);
    const db = createDB(c.env.DB);

    const row = await db
        .select()
        .from(schema.passwordResetTokens)
        .where(and(eq(schema.passwordResetTokens.tokenHash, tokenHash), eq(schema.passwordResetTokens.purpose, 'password_reset')))
        .limit(1)
        .then((rows) => rows[0]);

    const isExpiredOrUsed = !row || Boolean(row.consumedAt) || new Date(row.expiresAt).getTime() <= Date.now();
    if (!row || isExpiredOrUsed) {
        return c.json(
            { error: 'This reset link is invalid or has expired. Please request a new one.' },
            400
        );
    }

    const passwordHash = await hashPassword(newPassword);

    // Bumping token_version invalidates every JWT issued before this reset —
    // a compromised or forgotten password shouldn't leave old sessions valid.
    await db
        .update(schema.adminUsers)
        .set({ passwordHash, tokenVersion: sql`${schema.adminUsers.tokenVersion} + 1` })
        .where(eq(schema.adminUsers.id, row.adminUserId));

    await db
        .update(schema.passwordResetTokens)
        .set({ consumedAt: new Date().toISOString() })
        .where(eq(schema.passwordResetTokens.id, row.id));

    return c.json({
        success: true,
        message: 'Your password has been reset. You can now sign in with your new password.',
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — Confirm Admin Email Change (public, no JWT required)
//
// The request half (POST /account/change-email/request, below the JWT line)
// requires the current session + current password. The link it emails to the
// NEW address is opened unauthenticated — same shape as reset-password — and
// is the only step that actually commits the new email.
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.use('/account/change-email/confirm', rateLimiter(8, 15 * 60 * 1000, 'rl:admin-email-confirm'));

adminRouter.post('/account/change-email/confirm', async (c) => {
    const result = await parseBody(c, ConfirmEmailChangeSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const { token } = result.data;

    const tokenHash = await hashResetToken(token);
    const db = createDB(c.env.DB);

    const row = await db
        .select()
        .from(schema.passwordResetTokens)
        .where(and(eq(schema.passwordResetTokens.tokenHash, tokenHash), eq(schema.passwordResetTokens.purpose, 'email_change')))
        .limit(1)
        .then((rows) => rows[0]);

    const isExpiredOrUsed = !row || Boolean(row.consumedAt) || new Date(row.expiresAt).getTime() <= Date.now();
    const INVALID_MESSAGE = 'This verification link is invalid or has expired. Please request the email change again.';
    if (!row || isExpiredOrUsed || !row.newEmail) {
        return c.json({ error: INVALID_MESSAGE }, 400);
    }

    try {
        await db
            .update(schema.adminUsers)
            .set({ email: row.newEmail, tokenVersion: sql`${schema.adminUsers.tokenVersion} + 1` })
            .where(eq(schema.adminUsers.id, row.adminUserId));
    } catch {
        // Most likely a UNIQUE constraint on admin_users.email — never confirm
        // or deny whether another account holds that address.
        return c.json({ error: 'That email address can\'t be used. Please choose a different one.' }, 409);
    }

    await db
        .update(schema.passwordResetTokens)
        .set({ consumedAt: new Date().toISOString() })
        .where(eq(schema.passwordResetTokens.id, row.id));

    return c.json({
        success: true,
        message: 'Your admin login email has been updated. Please sign in again with your new email.',
    });
});

// ─── Apply JWT to all routes below ───────────────────────────────────────────

adminRouter.use('/*', jwtMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// CONTACTS
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.get('/contacts', async (c) => {
    const query = PaginationSchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    const { page, limit, status } = query.success ? query.data : { page: 1, limit: 20, status: 'all' as const };

    const db = createDB(c.env.DB);

    const baseQuery = db.select().from(schema.contactMessages);
    const filtered = status !== 'all'
        ? baseQuery.where(eq(schema.contactMessages.status, status))
        : baseQuery;

    const rows = await filtered
        .orderBy(desc(schema.contactMessages.createdAt))
        .limit(limit)
        .offset((page - 1) * limit);

    return c.json({ data: rows, page, limit });
});

adminRouter.put('/contacts/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const result = await parseBody(c, UpdateContactStatusSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);

    const db = createDB(c.env.DB);
    await db
        .update(schema.contactMessages)
        .set({ status: result.data.status, updatedAt: new Date().toISOString() })
        .where(eq(schema.contactMessages.id, id));

    return c.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.get('/services', async (c) => {
    const db = createDB(c.env.DB);
    const rows = await db.select().from(schema.services).orderBy(schema.services.sortOrder);
    return c.json({ data: rows.map(parseService) });
});

adminRouter.post('/services', async (c) => {
    const result = await parseBody(c, ServiceWriteSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const d = result.data;

    const db = createDB(c.env.DB);
    await db.insert(schema.services).values({
        id: d.id, name: d.name,
        shortDescription: d.shortDescription, longDescription: d.longDescription,
        icon: d.icon, timeline: d.timeline,
        whoItsForJson: JSON.stringify(d.whoItsFor),
        includedJson: JSON.stringify(d.included),
        pricingJson: JSON.stringify(d.pricing),
        sortOrder: d.sortOrder, isActive: d.isActive,
    });

    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.SERVICES);
    return c.json({ success: true, id: d.id }, 201);
});

adminRouter.put('/services/:id', async (c) => {
    const id = c.req.param('id');
    const result = await parseBody(c, ServiceWriteSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const d = result.data;

    const db = createDB(c.env.DB);
    await db.update(schema.services)
        .set({
            name: d.name, shortDescription: d.shortDescription,
            longDescription: d.longDescription, icon: d.icon, timeline: d.timeline,
            whoItsForJson: JSON.stringify(d.whoItsFor),
            includedJson: JSON.stringify(d.included),
            pricingJson: JSON.stringify(d.pricing),
            sortOrder: d.sortOrder, isActive: d.isActive,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.services.id, id));

    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.SERVICES);
    return c.json({ success: true });
});

adminRouter.delete('/services/:id', async (c) => {
    const id = c.req.param('id');
    const db = createDB(c.env.DB);
    await db.delete(schema.services).where(eq(schema.services.id, id));
    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.SERVICES);
    return c.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// SOLUTIONS
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.get('/solutions', async (c) => {
    const db = createDB(c.env.DB);
    const rows = await db.select().from(schema.solutions).orderBy(schema.solutions.sortOrder);
    return c.json({ data: rows.map(parseSolution) });
});

adminRouter.post('/solutions', async (c) => {
    const result = await parseBody(c, SolutionWriteSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const d = result.data;

    const db = createDB(c.env.DB);
    await db.insert(schema.solutions).values({
        id: d.id, title: d.title, icon: d.icon, description: d.description,
        ctaText: d.ctaText,
        painsJson: JSON.stringify(d.pains),
        benefitsJson: JSON.stringify(d.benefits),
        sortOrder: d.sortOrder, isActive: d.isActive,
    });

    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.SOLUTIONS);
    return c.json({ success: true, id: d.id }, 201);
});

adminRouter.put('/solutions/:id', async (c) => {
    const id = c.req.param('id');
    const result = await parseBody(c, SolutionWriteSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const d = result.data;

    const db = createDB(c.env.DB);
    await db.update(schema.solutions)
        .set({
            title: d.title, icon: d.icon, description: d.description,
            ctaText: d.ctaText,
            painsJson: JSON.stringify(d.pains),
            benefitsJson: JSON.stringify(d.benefits),
            sortOrder: d.sortOrder, isActive: d.isActive,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.solutions.id, id));

    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.SOLUTIONS);
    return c.json({ success: true });
});

adminRouter.delete('/solutions/:id', async (c) => {
    const id = c.req.param('id');
    const db = createDB(c.env.DB);
    await db.delete(schema.solutions).where(eq(schema.solutions.id, id));
    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.SOLUTIONS);
    return c.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRICING PLANS
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.get('/pricing/plans', async (c) => {
    const db = createDB(c.env.DB);
    const rows = await db.select().from(schema.pricingPlans).orderBy(schema.pricingPlans.sortOrder);
    return c.json({ data: rows.map(parsePricingPlan) });
});

adminRouter.post('/pricing/plans', async (c) => {
    const result = await parseBody(c, PricingPlanWriteSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const d = result.data;

    const db = createDB(c.env.DB);
    await db.insert(schema.pricingPlans).values({
        id: d.id, name: d.name, description: d.description,
        monthlyPrice: d.monthlyPrice, setupFee: d.setupFee,
        bestFor: d.bestFor, ctaText: d.ctaText, badge: d.badge,
        isHighlighted: d.isHighlighted,
        featuresJson: JSON.stringify(d.features),
        sortOrder: d.sortOrder, isActive: d.isActive,
    });

    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.PRICING);
    return c.json({ success: true, id: d.id }, 201);
});

adminRouter.put('/pricing/plans/:id', async (c) => {
    const id = c.req.param('id');
    const result = await parseBody(c, PricingPlanWriteSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const d = result.data;

    const db = createDB(c.env.DB);
    await db.update(schema.pricingPlans)
        .set({
            name: d.name, description: d.description,
            monthlyPrice: d.monthlyPrice, setupFee: d.setupFee,
            bestFor: d.bestFor, ctaText: d.ctaText, badge: d.badge,
            isHighlighted: d.isHighlighted,
            featuresJson: JSON.stringify(d.features),
            sortOrder: d.sortOrder, isActive: d.isActive,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.pricingPlans.id, id));

    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.PRICING);
    return c.json({ success: true });
});

adminRouter.delete('/pricing/plans/:id', async (c) => {
    const id = c.req.param('id');
    const db = createDB(c.env.DB);
    await db.delete(schema.pricingPlans).where(eq(schema.pricingPlans.id, id));
    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.PRICING);
    return c.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRICING ADD-ONS
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.get('/pricing/addons', async (c) => {
    const db = createDB(c.env.DB);
    const rows = await db.select().from(schema.pricingAddons).orderBy(schema.pricingAddons.sortOrder);
    return c.json({ data: rows });
});

adminRouter.post('/pricing/addons', async (c) => {
    const result = await parseBody(c, PricingAddonWriteSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const d = result.data;

    const db = createDB(c.env.DB);
    await db.insert(schema.pricingAddons).values({
        id: d.id, name: d.name, description: d.description,
        price: d.price, priceType: d.priceType,
        sortOrder: d.sortOrder, isActive: d.isActive,
    });

    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.PRICING);
    return c.json({ success: true, id: d.id }, 201);
});

adminRouter.put('/pricing/addons/:id', async (c) => {
    const id = c.req.param('id');
    const result = await parseBody(c, PricingAddonWriteSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const d = result.data;

    const db = createDB(c.env.DB);
    await db.update(schema.pricingAddons)
        .set({
            name: d.name, description: d.description,
            price: d.price, priceType: d.priceType,
            sortOrder: d.sortOrder, isActive: d.isActive,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.pricingAddons.id, id));

    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.PRICING);
    return c.json({ success: true });
});

adminRouter.delete('/pricing/addons/:id', async (c) => {
    const id = c.req.param('id');
    const db = createDB(c.env.DB);
    await db.delete(schema.pricingAddons).where(eq(schema.pricingAddons.id, id));
    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.PRICING);
    return c.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// FAQs
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.get('/faq', async (c) => {
    const db = createDB(c.env.DB);
    const rows = await db.select().from(schema.faqs).orderBy(schema.faqs.sortOrder);
    return c.json({ data: rows });
});

adminRouter.post('/faq', async (c) => {
    const result = await parseBody(c, FAQWriteSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const d = result.data;

    const db = createDB(c.env.DB);
    await db.insert(schema.faqs).values({
        id: d.id, question: d.question, answer: d.answer,
        category: d.category, sortOrder: d.sortOrder, isActive: d.isActive,
    });

    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.FAQ);
    return c.json({ success: true, id: d.id }, 201);
});

adminRouter.put('/faq/:id', async (c) => {
    const id = c.req.param('id');
    const result = await parseBody(c, FAQWriteSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const d = result.data;

    const db = createDB(c.env.DB);
    await db.update(schema.faqs)
        .set({
            question: d.question, answer: d.answer,
            category: d.category, sortOrder: d.sortOrder, isActive: d.isActive,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.faqs.id, id));

    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.FAQ);
    return c.json({ success: true });
});

adminRouter.delete('/faq/:id', async (c) => {
    const id = c.req.param('id');
    const db = createDB(c.env.DB);
    await db.delete(schema.faqs).where(eq(schema.faqs.id, id));
    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.FAQ);
    return c.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// SITE SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

function parseSiteSettingsRow(row: schema.SiteSettingsRow) {
    const footer = JSON.parse(row.footerJson || '{}') as { sections?: unknown; copyright?: string; socialLinks?: unknown };
    return {
        brand: {
            name: row.brandName,
            tagline: row.brandTagline,
            description: row.brandDescription,
            headerLogoUrl: assetUrl(row.headerLogoAssetId),
            footerLogoUrl: assetUrl(row.footerLogoAssetId),
        },
        navigation: JSON.parse(row.navigationJson || '[]') as unknown[],
        footer: {
            sections: footer.sections ?? [],
            copyright: footer.copyright ?? '',
            socialLinks: normalizeSocialLinks(footer.socialLinks),
        },
        contact: {
            email: row.contactEmail,
            phone: row.contactPhone,
        },
    };
}

adminRouter.get('/site', async (c) => {
    const db = createDB(c.env.DB);
    const row = await db.select().from(schema.siteSettings).limit(1).then((r) => r[0]);
    if (!row) {
        return c.json({ data: null });
    }
    return c.json({ data: parseSiteSettingsRow(row) });
});

adminRouter.put('/site', async (c) => {
    const result = await parseBody(c, SiteSettingsWriteSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const d = result.data;

    const db = createDB(c.env.DB);

    // Upsert — site_settings is a single-row table (id = 1)
    const existing = await db.select({ id: schema.siteSettings.id })
        .from(schema.siteSettings).limit(1).then((r) => r[0]);

    const values: schema.SiteSettingsInsert = {
        brandName: d.brandName, brandTagline: d.brandTagline,
        brandDescription: d.brandDescription ?? '',
        contactEmail: d.contactEmail, contactPhone: d.contactPhone ?? undefined,
        navigationJson: JSON.stringify(d.navigation ?? []),
        footerJson: JSON.stringify(d.footer ?? { sections: [], socialLinks: [], copyright: '' }),
        updatedAt: new Date().toISOString(),
    };

    if (existing) {
        await db.update(schema.siteSettings).set(values).where(eq(schema.siteSettings.id, existing.id));
    } else {
        await db.insert(schema.siteSettings).values(values);
    }

    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.SITE);
    return c.json({ success: true });
});

// Lets the admin UI proactively explain unavailable features (e.g. disable
// the logo upload control with a clear reason) instead of only surfacing it
// after a failed attempt. Booleans only — never exposes bucket names,
// provider identifiers, or any other configuration detail.
adminRouter.get('/capabilities', (c) => {
    return c.json({
        data: {
            logoStorageConfigured: isLogoStorageConfigured(c.env),
            passwordResetEmailConfigured: isEmailProviderConfigured(c.env),
        },
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT / SECURITY — change the admin login email (requires JWT above)
//
// The login email is only an account identifier in D1 — changing it here
// does not create or move any mailbox. This never completes without a
// configured transactional-email provider and a verification click from the
// NEW address, so it can never silently point the account at an inbox the
// operator can't access.
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.use('/account/change-email/request', rateLimiter(5, 15 * 60 * 1000, 'rl:admin-email-req'));

adminRouter.post('/account/change-email/request', async (c) => {
    if (!isEmailProviderConfigured(c.env)) {
        return c.json(
            { error: 'Changing the admin email requires transactional email to be configured first. Please contact the site administrator.' },
            503
        );
    }

    const result = await parseBody(c, RequestEmailChangeSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const { currentPassword, newEmail } = result.data;

    const payload = c.get('jwtPayload');
    const db = createDB(c.env.DB);

    const user = await db
        .select()
        .from(schema.adminUsers)
        .where(eq(schema.adminUsers.id, Number(payload.sub)))
        .limit(1)
        .then((rows) => rows[0]);

    if (!user) return c.json({ error: 'Session is no longer valid. Please sign in again.' }, 401);

    // 403 (not 401) — this is a re-authentication check on an already-valid
    // session, not a session/token problem, so the client must not treat it
    // as "log the admin out."
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return c.json({ error: 'Current password is incorrect.' }, 403);

    if (newEmail === user.email) {
        return c.json({ error: 'That is already your current admin email.' }, 422);
    }

    const { token, tokenHash } = await generateResetToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

    await db.insert(schema.passwordResetTokens).values({
        adminUserId: user.id,
        tokenHash,
        expiresAt,
        purpose: 'email_change',
        newEmail,
    });

    const origin = getCanonicalAppOrigin(c.env, c.req.header('origin'));
    const verifyUrl = `${origin}/admin/verify-email-change?token=${token}`;

    const sendResult = await sendEmailChangeVerificationEmail(c.env, newEmail, verifyUrl);
    if (!sendResult.ok) {
        return c.json({ error: 'Could not send the verification email. Please try again shortly.' }, 502);
    }

    return c.json({
        success: true,
        message: `A verification link has been sent to ${newEmail}. Your admin email won't change until you open it.`,
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// LEGAL PAGES
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.get('/legal', async (c) => {
    const db = createDB(c.env.DB);
    const rows = await db.select().from(schema.legalPages);
    return c.json({ data: rows });
});

adminRouter.put('/legal/:id', async (c) => {
    const id = c.req.param('id');
    if (id !== 'privacy-policy' && id !== 'terms-of-service') {
        return c.json({ error: 'Unknown legal page id' }, 404);
    }

    const result = await parseBody(c, LegalPageWriteSchema);
    if (!result.ok) return c.json({ error: result.error }, 422);
    const d = result.data;

    const db = createDB(c.env.DB);
    await db.update(schema.legalPages)
        .set({
            title: d.title,
            body: d.body,
            isPublished: d.isPublished,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.legalPages.id, id));

    return c.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// HEADER/FOOTER LOGO ASSETS
// ─────────────────────────────────────────────────────────────────────────────

const LOGO_TARGETS = ['header', 'footer'] as const;
type LogoTarget = (typeof LOGO_TARGETS)[number];

function isLogoTarget(value: unknown): value is LogoTarget {
    return typeof value === 'string' && (LOGO_TARGETS as readonly string[]).includes(value);
}

/** Deletes the underlying stored asset only if no site_settings column references it anymore. */
async function pruneAssetIfOrphaned(db: ReturnType<typeof createDB>, env: Env, assetId: string | null) {
    if (!assetId) return;
    const row = await db.select({
        headerLogoAssetId: schema.siteSettings.headerLogoAssetId,
        footerLogoAssetId: schema.siteSettings.footerLogoAssetId,
    }).from(schema.siteSettings).limit(1).then((r) => r[0]);

    const stillReferenced = row?.headerLogoAssetId === assetId || row?.footerLogoAssetId === assetId;
    if (stillReferenced) return;

    const asset = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, assetId)).limit(1).then((r) => r[0]);
    if (!asset) return;

    await deleteLogoAssetFromStorage(env, asset.r2Key);
    await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, assetId));
}

adminRouter.post('/assets/logo', async (c) => {
    const target = c.req.query('target');
    if (!isLogoTarget(target)) {
        return c.json({ error: 'target must be "header" or "footer"' }, 400);
    }

    if (!isLogoStorageConfigured(c.env)) {
        return c.json(
            { error: 'Logo storage is not configured yet. Please contact the site administrator.' },
            503
        );
    }

    const declaredType = c.req.header('Content-Type') ?? '';
    let bytes: Uint8Array;
    try {
        bytes = new Uint8Array(await c.req.arrayBuffer());
    } catch {
        return c.json({ error: 'Could not read the uploaded file.' }, 400);
    }

    const validation = validateLogoUpload(bytes, declaredType);
    if (!validation.ok) {
        return c.json({ error: validation.error }, 422);
    }

    const stored = await putLogoAsset(c.env, bytes, validation.contentType);
    if (!stored) {
        return c.json({ error: 'Logo storage is not configured yet. Please contact the site administrator.' }, 503);
    }

    const db = createDB(c.env.DB);
    await db.insert(schema.mediaAssets).values({
        id: stored.id,
        r2Key: stored.r2Key,
        contentType: stored.contentType,
        sizeBytes: stored.sizeBytes,
    });

    const existing = await db.select({
        id: schema.siteSettings.id,
        headerLogoAssetId: schema.siteSettings.headerLogoAssetId,
        footerLogoAssetId: schema.siteSettings.footerLogoAssetId,
    }).from(schema.siteSettings).limit(1).then((r) => r[0]);

    if (!existing) {
        return c.json({ error: 'Site settings must be initialized before uploading a logo.' }, 409);
    }

    const previousAssetId = target === 'header' ? existing.headerLogoAssetId : existing.footerLogoAssetId;

    await db.update(schema.siteSettings)
        .set(target === 'header' ? { headerLogoAssetId: stored.id } : { footerLogoAssetId: stored.id })
        .where(eq(schema.siteSettings.id, existing.id));

    await pruneAssetIfOrphaned(db, c.env, previousAssetId ?? null);
    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.SITE);

    return c.json({ success: true, url: assetUrl(stored.id) }, 201);
});

adminRouter.delete('/assets/logo', async (c) => {
    const target = c.req.query('target');
    if (!isLogoTarget(target)) {
        return c.json({ error: 'target must be "header" or "footer"' }, 400);
    }

    const db = createDB(c.env.DB);
    const existing = await db.select({
        id: schema.siteSettings.id,
        headerLogoAssetId: schema.siteSettings.headerLogoAssetId,
        footerLogoAssetId: schema.siteSettings.footerLogoAssetId,
    }).from(schema.siteSettings).limit(1).then((r) => r[0]);

    if (!existing) {
        return c.json({ success: true });
    }

    const previousAssetId = target === 'header' ? existing.headerLogoAssetId : existing.footerLogoAssetId;

    await db.update(schema.siteSettings)
        .set(target === 'header' ? { headerLogoAssetId: null } : { footerLogoAssetId: null })
        .where(eq(schema.siteSettings.id, existing.id));

    await pruneAssetIfOrphaned(db, c.env, previousAssetId ?? null);
    await kvInvalidate(c.env.CONTENT_KV, KV_KEYS.SITE);

    return c.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS (Observability / Read-Only)
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.use('/payments/*', rateLimiter(60, 60 * 1000, 'rl:admin:payments'));

adminRouter.get('/payments/orders', async (c) => {
    const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams);
    const parsed = AdminPaymentOrdersQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
        return c.json({ error: 'Invalid query parameters', fields: parsed.error.flatten().fieldErrors }, 400);
    }

    const db = createDB(c.env.DB);
    const result = await getAdminPaymentOrders(db, parsed.data);
    return c.json({ data: result });
});

adminRouter.get('/payments/orders/:orderId', async (c) => {
    const orderId = c.req.param('orderId');
    if (!orderId || !/^[a-zA-Z0-9_-]{1,64}$/.test(orderId)) {
        return c.json({ error: 'Invalid order ID format' }, 400);
    }

    const db = createDB(c.env.DB);
    const result = await getAdminPaymentOrderDetail(db, orderId);
    if (!result) {
        return c.json({ error: 'Payment order not found' }, 404);
    }

    return c.json({ data: result });
});

adminRouter.get('/payments/summary', async (c) => {
    const db = createDB(c.env.DB);
    const summary = await getAdminPaymentSummary(db);
    return c.json({ data: summary });
});

// ─────────────────────────────────────────────────────────────────────────────
// OPERATIONAL / SCHEMA HEALTH (Admin Only)
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.get('/health/schema', async (c) => {
    const db = createDB(c.env.DB);
    const health = await verifyDatabaseSchema(db);
    return c.json({ data: health }, health.ok ? 200 : 503);
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS (Admin Management)
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.use('/customers/*', rateLimiter(60, 60 * 1000, 'rl:admin:customers'));

adminRouter.get('/customers', async (c) => {
    const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams);
    const parsed = AdminCustomersQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
        return c.json({ error: 'Invalid query parameters', fields: parsed.error.flatten().fieldErrors }, 400);
    }

    const db = createDB(c.env.DB);
    const result = await getAdminCustomers(db, parsed.data);
    return c.json({ data: result });
});

adminRouter.get('/customers/:customerId', async (c) => {
    const customerId = c.req.param('customerId');
    if (!customerId || !/^usr_[a-zA-Z0-9_-]+$/.test(customerId)) {
        return c.json({ error: 'Invalid customer ID format' }, 400);
    }

    const db = createDB(c.env.DB);
    const detail = await getAdminCustomerDetail(db, customerId);
    if (!detail) {
        return c.json({ error: 'Customer not found' }, 404);
    }

    return c.json({ data: detail });
});

adminRouter.post('/customers/:customerId/disable', async (c) => {
    const customerId = c.req.param('customerId');
    if (!customerId || !/^usr_[a-zA-Z0-9_-]+$/.test(customerId)) {
        return c.json({ error: 'Invalid customer ID format' }, 400);
    }

    const db = createDB(c.env.DB);
    try {
        const result = await adminSetCustomerDisabled(db, customerId, true);
        return c.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to disable customer';
        return c.json({ error: message }, 400);
    }
});

adminRouter.post('/customers/:customerId/enable', async (c) => {
    const customerId = c.req.param('customerId');
    if (!customerId || !/^usr_[a-zA-Z0-9_-]+$/.test(customerId)) {
        return c.json({ error: 'Invalid customer ID format' }, 400);
    }

    const db = createDB(c.env.DB);
    try {
        const result = await adminSetCustomerDisabled(db, customerId, false);
        return c.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to enable customer';
        return c.json({ error: message }, 400);
    }
});


