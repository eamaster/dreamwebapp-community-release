/**
 * Server-side knowledge builder for the AI chat assistant.
 *
 * The chatbot's approved knowledge boundary is exactly the same public
 * content already served by `routes/content.ts` (site, services, solutions,
 * pricing, FAQ) — read via the same KV-first, D1-fallback strategy so no
 * content is duplicated or hardcoded into a large prompt string. This module
 * only normalizes that content into a compact text context for the model.
 *
 * No chat-specific tables or vector store are introduced — this is
 * intentionally a lightweight MVP knowledge source, not a RAG pipeline.
 */

import { eq, asc } from 'drizzle-orm';
import type { Env } from '../types/env';
import { createDB } from '../db';
import * as schema from '../db/schema';
import { kvGet, KV_KEYS } from '../middleware/cache';

interface KnowledgeSite {
    name: string;
    tagline: string;
    description: string;
}

interface KnowledgeService {
    name: string;
    shortDescription: string;
    timeline: string;
    priceLabel: string;
}

interface KnowledgeSolution {
    title: string;
    description: string;
}

interface KnowledgePricingPlan {
    name: string;
    monthlyPrice: number;
    setupFee?: number | null;
    bestFor: string;
}

interface KnowledgeFAQ {
    question: string;
    answer: string;
}

function formatPrice(pricing: { type: string; amount?: number; note?: string }): string {
    if (pricing.type === 'one-time' && pricing.amount) return `$${pricing.amount} one-time setup fee`;
    if (pricing.type === 'monthly' && pricing.amount) return `$${pricing.amount}/month`;
    return pricing.note ?? 'custom pricing';
}

async function getSite(env: Env): Promise<KnowledgeSite | null> {
    const cached = await kvGet<{ brand: KnowledgeSite }>(env.CONTENT_KV, KV_KEYS.SITE);
    if (cached) return cached.brand;

    const db = createDB(env.DB);
    const row = await db.select().from(schema.siteSettings).limit(1).then((rows) => rows[0]);
    if (!row) return null;
    return { name: row.brandName, tagline: row.brandTagline, description: row.brandDescription };
}

interface CachedServiceContent {
    name: string;
    shortDescription: string;
    timeline: string;
    pricing: { type: string; amount?: number; note?: string };
}

async function getServices(env: Env): Promise<KnowledgeService[]> {
    const cached = await kvGet<CachedServiceContent[]>(env.CONTENT_KV, KV_KEYS.SERVICES);
    if (cached) {
        return cached.map((row) => ({
            name: row.name,
            shortDescription: row.shortDescription,
            timeline: row.timeline,
            priceLabel: formatPrice(row.pricing),
        }));
    }

    const db = createDB(env.DB);
    const rows = await db
        .select()
        .from(schema.services)
        .where(eq(schema.services.isActive, true))
        .orderBy(asc(schema.services.sortOrder));

    return rows.map((row) => {
        const pricing = JSON.parse(row.pricingJson) as { type: string; amount?: number; note?: string };
        return {
            name: row.name,
            shortDescription: row.shortDescription,
            timeline: row.timeline,
            priceLabel: formatPrice(pricing),
        };
    });
}

async function getSolutions(env: Env): Promise<KnowledgeSolution[]> {
    const cached = await kvGet<Array<{ title: string; description: string }>>(env.CONTENT_KV, KV_KEYS.SOLUTIONS);
    if (cached) return cached.map((row) => ({ title: row.title, description: row.description }));

    const db = createDB(env.DB);
    const rows = await db
        .select()
        .from(schema.solutions)
        .where(eq(schema.solutions.isActive, true))
        .orderBy(asc(schema.solutions.sortOrder));

    return rows.map((row) => ({ title: row.title, description: row.description }));
}

async function getPricingPlans(env: Env): Promise<KnowledgePricingPlan[]> {
    const cached = await kvGet<{ plans: KnowledgePricingPlan[] }>(env.CONTENT_KV, KV_KEYS.PRICING);
    if (cached) return cached.plans;

    const db = createDB(env.DB);
    const rows = await db
        .select()
        .from(schema.pricingPlans)
        .where(eq(schema.pricingPlans.isActive, true))
        .orderBy(asc(schema.pricingPlans.sortOrder));

    return rows.map((row) => ({
        name: row.name,
        monthlyPrice: row.monthlyPrice,
        setupFee: row.setupFee,
        bestFor: row.bestFor,
    }));
}

async function getFAQs(env: Env): Promise<KnowledgeFAQ[]> {
    const cached = await kvGet<Array<{ question: string; answer: string }>>(env.CONTENT_KV, KV_KEYS.FAQ);
    if (cached) return cached.map((row) => ({ question: row.question, answer: row.answer }));

    const db = createDB(env.DB);
    const rows = await db
        .select()
        .from(schema.faqs)
        .where(eq(schema.faqs.isActive, true))
        .orderBy(asc(schema.faqs.sortOrder));

    return rows.map((row) => ({ question: row.question, answer: row.answer }));
}

/** Hard cap on the assembled knowledge context to bound prompt size/cost. */
const MAX_CONTEXT_CHARS = 6000;

/**
 * Build a concise, plain-text knowledge context from the site's approved
 * public content (site, services, solutions, pricing, FAQ). This is the
 * chatbot's entire factual knowledge boundary — nothing outside this text
 * should be presented to the model as fact.
 */
export async function buildKnowledgeContext(env: Env): Promise<string> {
    const [site, services, solutions, plans, faqs] = await Promise.all([
        getSite(env),
        getServices(env),
        getSolutions(env),
        getPricingPlans(env),
        getFAQs(env),
    ]);

    const lines: string[] = [];

    if (site) {
        lines.push(`Business: ${site.name} — ${site.tagline}`);
        lines.push(site.description);
        lines.push('');
    }

    if (services.length > 0) {
        lines.push('SERVICES:');
        for (const s of services) {
            lines.push(`- ${s.name}: ${s.shortDescription} (Timeline: ${s.timeline}; Price: ${s.priceLabel})`);
        }
        lines.push('');
    }

    if (solutions.length > 0) {
        lines.push('SOLUTIONS BY BUSINESS TYPE:');
        for (const s of solutions) {
            lines.push(`- ${s.title}: ${s.description}`);
        }
        lines.push('');
    }

    if (plans.length > 0) {
        lines.push('PRICING PLANS:');
        for (const p of plans) {
            const setup = p.setupFee ? `, $${p.setupFee} setup fee` : '';
            lines.push(`- ${p.name}: $${p.monthlyPrice}/month${setup} — best for: ${p.bestFor}`);
        }
        lines.push('');
    }

    if (faqs.length > 0) {
        lines.push('FREQUENTLY ASKED QUESTIONS:');
        for (const f of faqs.slice(0, 20)) {
            lines.push(`Q: ${f.question}`);
            lines.push(`A: ${f.answer.slice(0, 400)}`);
        }
    }

    const context = lines.join('\n');
    return context.length > MAX_CONTEXT_CHARS ? `${context.slice(0, MAX_CONTEXT_CHARS)}…` : context;
}
