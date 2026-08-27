/**
 * Public Content API routes — GET /api/v1/content/*
 *
 * Three-tier read strategy per endpoint:
 *   1. Cloudflare Edge Cache (handled via Cache-Control response headers)
 *   2. Cloudflare KV  (CONTENT_KV)
 *   3. Cloudflare D1  (via Drizzle ORM)
 *
 * All responses include Cache-Control: public, max-age=3600, stale-while-revalidate=86400
 */

import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import type { Context } from 'hono';
import type { Env } from '../types/env';
import type { HonoVariables } from '../middleware/auth';
import { createDB } from '../db';
import * as schema from '../db/schema';
import { kvGet, kvSet, KV_KEYS, CACHE_CONTROL } from '../middleware/cache';
import { normalizeSocialLinks } from '../lib/social-links';
import { assetUrl, isAllowedLogoType } from '../lib/media-assets';

type AppContext = { Bindings: Env; Variables: HonoVariables };

// ─── Type Helpers ─────────────────────────────────────────────────────────────

// Parse JSON columns back to their JS shapes
function parseService(row: schema.ServiceRow) {
    return {
        id: row.id,
        name: row.name,
        shortDescription: row.shortDescription,
        longDescription: row.longDescription,
        icon: row.icon,
        timeline: row.timeline,
        whoItsFor: JSON.parse(row.whoItsForJson) as string[],
        included: JSON.parse(row.includedJson) as string[],
        pricing: JSON.parse(row.pricingJson) as { type: string; amount?: number; note?: string },
        sortOrder: row.sortOrder,
    };
}

function parseSolution(row: schema.SolutionRow) {
    return {
        id: row.id,
        title: row.title,
        icon: row.icon,
        description: row.description,
        ctaText: row.ctaText,
        pains: JSON.parse(row.painsJson) as string[],
        benefits: JSON.parse(row.benefitsJson) as string[],
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
        features: JSON.parse(row.featuresJson) as string[],
    };
}

function parseFAQ(row: schema.FAQRow) {
    return {
        id: row.id,
        question: row.question,
        answer: row.answer,
        category: row.category,
    };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const contentRouter = new Hono<AppContext>();

/**
 * Helper: set caching headers and return a JSON response.
 */
function cachedJson(c: Context<AppContext>, data: unknown, fromKV: boolean) {
    c.header('Cache-Control', CACHE_CONTROL.PUBLIC_CONTENT);
    c.header('X-Cache-Hit', fromKV ? 'KV' : 'DB');
    c.header('Vary', 'Accept-Encoding');
    return c.json({ data, timestamp: new Date().toISOString() });
}

// ── GET /api/v1/content/site ─────────────────────────────────────────────────

contentRouter.get('/site', async (c) => {
    // 1. KV check
    const cached = await kvGet(c.env.CONTENT_KV, KV_KEYS.SITE);
    if (cached) return cachedJson(c, cached, true);

    // 2. D1 query
    const db = createDB(c.env.DB);
    const row = await db
        .select()
        .from(schema.siteSettings)
        .limit(1)
        .then((rows) => rows[0]);

    if (!row) {
        return c.json({ error: 'Site settings not found' }, 404);
    }

    const footer = JSON.parse(row.footerJson) as { sections?: unknown; copyright?: string; socialLinks?: unknown };

    const data = {
        brand: {
            name: row.brandName,
            tagline: row.brandTagline,
            description: row.brandDescription,
            headerLogoUrl: assetUrl(row.headerLogoAssetId),
            footerLogoUrl: assetUrl(row.footerLogoAssetId),
        },
        navigation: JSON.parse(row.navigationJson) as unknown[],
        footer: {
            sections: footer.sections ?? [],
            copyright: footer.copyright ?? '',
            socialLinks: normalizeSocialLinks(footer.socialLinks).filter((link) => link.enabled),
        },
        contact: {
            email: row.contactEmail,
            phone: row.contactPhone,
        },
    };

    // 3. Store in KV
    await kvSet(c.env.CONTENT_KV, KV_KEYS.SITE, data);

    return cachedJson(c, data, false);
});

// ── GET /api/v1/content/legal/:id ─────────────────────────────────────────────
// Public legal pages (Privacy Policy / Terms of Service). Returns `data: null`
// when the page has not been published yet — a normal, non-error state.

contentRouter.get('/legal/:id', async (c) => {
    const id = c.req.param('id');
    if (id !== 'privacy-policy' && id !== 'terms-of-service') {
        return c.json({ error: 'Unknown legal page' }, 404);
    }

    const db = createDB(c.env.DB);
    const row = await db
        .select()
        .from(schema.legalPages)
        .where(eq(schema.legalPages.id, id))
        .limit(1)
        .then((rows) => rows[0]);

    c.header('Cache-Control', CACHE_CONTROL.PUBLIC_CONTENT);

    if (!row || !row.isPublished) {
        return c.json({ data: null, timestamp: new Date().toISOString() });
    }

    return c.json({
        data: { id: row.id, title: row.title, body: row.body, updatedAt: row.updatedAt },
        timestamp: new Date().toISOString(),
    });
});

// ── GET/HEAD /api/v1/content/assets/:id ───────────────────────────────────────
// Public logo asset delivery — streams the R2 object with its validated content
// type. Allows cross-origin embedding via Cross-Origin-Resource-Policy: cross-origin.
// Long-lived immutable caching is safe: ids are server-generated opaque UUIDs.

contentRouter.on(['GET', 'HEAD'], '/assets/:id', async (c) => {
    if (!c.env.LOGO_ASSETS) {
        return c.json({ error: 'Asset storage is not configured' }, 404);
    }

    const id = c.req.param('id');
    const db = createDB(c.env.DB);
    const asset = await db
        .select()
        .from(schema.mediaAssets)
        .where(eq(schema.mediaAssets.id, id))
        .limit(1)
        .then((rows) => rows[0]);

    if (!asset || !isAllowedLogoType(asset.contentType)) {
        return c.json({ error: 'Asset not found' }, 404);
    }

    const isHead = c.req.method === 'HEAD';
    const object = isHead
        ? await c.env.LOGO_ASSETS.head(asset.r2Key)
        : await c.env.LOGO_ASSETS.get(asset.r2Key);

    if (!object) {
        return c.json({ error: 'Asset not found' }, 404);
    }

    c.header('Content-Type', asset.contentType);
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
    c.header('Cross-Origin-Resource-Policy', 'cross-origin');
    c.header('X-Content-Type-Options', 'nosniff');
    if (object.httpEtag) {
        c.header('ETag', object.httpEtag);
    }
    c.header('Last-Modified', object.uploaded.toUTCString());

    // Evaluate conditional HTTP request headers (If-None-Match takes precedence over If-Modified-Since)
    const ifNoneMatch = c.req.header('If-None-Match');
    const ifModifiedSince = c.req.header('If-Modified-Since');

    if (ifNoneMatch) {
        const tags = ifNoneMatch.split(',').map((t) => t.trim());
        const match = tags.some((t) => t === '*' || t === object.httpEtag || (object.etag && t === object.etag));
        if (match) {
            return c.body(null, 304);
        }
    } else if (ifModifiedSince) {
        const sinceDate = new Date(ifModifiedSince);
        if (!isNaN(sinceDate.getTime()) && object.uploaded.getTime() <= sinceDate.getTime()) {
            return c.body(null, 304);
        }
    }

    if (isHead) {
        return c.body(null, 200);
    }

    return c.body((object as R2ObjectBody).body);
});

// ── GET /api/v1/content/services ─────────────────────────────────────────────

contentRouter.get('/services', async (c) => {
    const cached = await kvGet(c.env.CONTENT_KV, KV_KEYS.SERVICES);
    if (cached) return cachedJson(c, cached, true);

    const db = createDB(c.env.DB);
    const rows = await db
        .select()
        .from(schema.services)
        .where(eq(schema.services.isActive, true))
        .orderBy(asc(schema.services.sortOrder));

    const data = rows.map(parseService);

    await kvSet(c.env.CONTENT_KV, KV_KEYS.SERVICES, data);
    return cachedJson(c, data, false);
});

// ── GET /api/v1/content/solutions ─────────────────────────────────────────────

contentRouter.get('/solutions', async (c) => {
    const cached = await kvGet(c.env.CONTENT_KV, KV_KEYS.SOLUTIONS);
    if (cached) return cachedJson(c, cached, true);

    const db = createDB(c.env.DB);
    const rows = await db
        .select()
        .from(schema.solutions)
        .where(eq(schema.solutions.isActive, true))
        .orderBy(asc(schema.solutions.sortOrder));

    const data = rows.map(parseSolution);

    await kvSet(c.env.CONTENT_KV, KV_KEYS.SOLUTIONS, data);
    return cachedJson(c, data, false);
});

// ── GET /api/v1/content/pricing ───────────────────────────────────────────────

contentRouter.get('/pricing', async (c) => {
    const cached = await kvGet(c.env.CONTENT_KV, KV_KEYS.PRICING);
    if (cached) return cachedJson(c, cached, true);

    const db = createDB(c.env.DB);

    const [planRows, addonRows] = await Promise.all([
        db
            .select()
            .from(schema.pricingPlans)
            .where(eq(schema.pricingPlans.isActive, true))
            .orderBy(asc(schema.pricingPlans.sortOrder)),
        db
            .select()
            .from(schema.pricingAddons)
            .where(eq(schema.pricingAddons.isActive, true))
            .orderBy(asc(schema.pricingAddons.sortOrder)),
    ]);

    const data = {
        plans: planRows.map(parsePricingPlan),
        addons: addonRows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            price: row.price,
            priceType: row.priceType,
        })),
    };

    await kvSet(c.env.CONTENT_KV, KV_KEYS.PRICING, data);
    return cachedJson(c, data, false);
});

// ── GET /api/v1/content/faq ───────────────────────────────────────────────────

contentRouter.get('/faq', async (c) => {
    const cached = await kvGet(c.env.CONTENT_KV, KV_KEYS.FAQ);
    if (cached) return cachedJson(c, cached, true);

    const db = createDB(c.env.DB);
    const rows = await db
        .select()
        .from(schema.faqs)
        .where(eq(schema.faqs.isActive, true))
        .orderBy(asc(schema.faqs.sortOrder));

    const data = rows.map(parseFAQ);

    await kvSet(c.env.CONTENT_KV, KV_KEYS.FAQ, data);
    return cachedJson(c, data, false);
});
