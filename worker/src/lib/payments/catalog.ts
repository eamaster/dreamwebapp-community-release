/**
 * Explicit server-side product/plan catalog for crypto checkout.
 *
 * Rules:
 *  - A plan is crypto-purchasable ONLY if explicitly defined in SERVER_CRYPTO_CATALOG with isActive: true.
 *  - D1 is used strictly to obtain the latest display name and verify the plan is active in DB.
 *  - Prices are NEVER derived from setupFee or monthlyPrice.
 *  - Monetary amounts are strictly stored and returned as decimal strings (no floats / parseFloat).
 *  - All crypto purchases are explicitly labeled as one-time payments.
 */

import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '../../db';
import * as schema from '../../db/schema';
import type { BillingMode } from './types';
import { normalizeDecimalString } from './money';

export interface CryptoPlanConfig {
    planKey: string;
    planName: string;
    priceAmountDecimal: string;
    priceCurrency: string;
    billingMode: BillingMode;
    isActive: boolean;
    description: string;
}

/**
 * Authoritative server-side crypto catalog definition matching the exact platform plans.
 * Plans not explicitly defined or flagged inactive will be rejected at checkout.
 */
export const SERVER_CRYPTO_CATALOG: Record<string, CryptoPlanConfig> = {
    'starter-bot': {
        planKey: 'starter-bot',
        planName: 'Starter Bot',
        priceAmountDecimal: '997.00',
        priceCurrency: 'usd',
        billingMode: 'one_time',
        isActive: true,
        description: 'Starter Bot (One-time setup & activation payment)',
    },
    'growth-bot': {
        planKey: 'growth-bot',
        planName: 'Growth Bot + Care',
        priceAmountDecimal: '997.00',
        priceCurrency: 'usd',
        billingMode: 'one_time',
        isActive: true,
        description: 'Growth Bot + Care (One-time setup fee payment)',
    },
    'pro-automation': {
        planKey: 'pro-automation',
        planName: 'Pro Automation Suite',
        priceAmountDecimal: '1997.00',
        priceCurrency: 'usd',
        billingMode: 'one_time',
        isActive: true,
        description: 'Pro Automation Suite (One-time setup fee payment)',
    },
};

export interface PlanPrice {
    planKey: string;
    planName: string;
    priceAmountDecimal: string; // e.g. "997.00"
    priceCurrency: string;      // e.g. "usd"
    billingMode: BillingMode;   // "one_time"
    description: string;
}

/**
 * Resolves the authoritative plan price and configuration.
 * Rejects checkout if no explicit configuration exists in SERVER_CRYPTO_CATALOG
 * or if plan is inactive in either the static catalog or D1 database.
 */
export async function getPlanPrice(
    db: DrizzleDB,
    planKey: string,
    priceCurrencyOverride?: string,
): Promise<PlanPrice | null> {
    const staticConfig = SERVER_CRYPTO_CATALOG[planKey];

    // Must exist in explicit crypto catalog and be active
    if (!staticConfig || !staticConfig.isActive) {
        return null;
    }

    // Verify against D1 database pricing_plans table if record exists
    const rows = await db
        .select()
        .from(schema.pricingPlans)
        .where(eq(schema.pricingPlans.id, planKey))
        .limit(1);

    const dbPlan = rows[0];

    // If plan exists in DB, it must also be active
    if (dbPlan && !dbPlan.isActive) {
        return null;
    }

    const currency = (priceCurrencyOverride ?? staticConfig.priceCurrency).toLowerCase();
    const amountDecimal = normalizeDecimalString(staticConfig.priceAmountDecimal, 2);

    return {
        planKey: staticConfig.planKey,
        planName: dbPlan?.name ?? staticConfig.planName,
        priceAmountDecimal: amountDecimal,
        priceCurrency: currency,
        billingMode: staticConfig.billingMode,
        description: `${dbPlan?.name ?? staticConfig.planName} (One-time payment)`,
    };
}
