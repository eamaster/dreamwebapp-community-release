/**
 * Explicit server-side product/plan catalog for crypto checkout.
 *
 * Rules:
 *  - A plan is crypto-purchasable ONLY if explicitly defined in SERVER_CRYPTO_CATALOG
 *    with isActive / checkoutEnabled / publicVisible as required by sale policy.
 *  - D1 supplies the CMS fee fields (setupFee / monthlyPrice) and active state.
 *  - Chargeable amounts are ALWAYS selected from CMS fees via resolvePlanCheckoutAmountDecimal.
 *    Catalog priceAmountDecimal values are historical seeds only — never charged.
 *  - Monetary amounts are stored and returned as decimal strings (no floats / parseFloat).
 *  - All crypto purchases are explicitly labeled as one-time payments.
 *  - Missing / invalid / non-positive payable amounts cannot create checkout.
 */

import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '../../db';
import * as schema from '../../db/schema';
import type { BillingMode } from './types';
import { evaluatePlanSale } from '../commercial/plan-sale-policy';

export interface CryptoPlanConfig {
    planKey: string;
    planName: string;
    /**
     * Historical seed amount for documentation / local fixtures only.
     * Checkout NEVER charges this value — CMS fee selection is authoritative.
     */
    priceAmountDecimal: string;
    priceCurrency: string;
    billingMode: BillingMode;
    isActive: boolean;
    /** When false, plan may still be listed publicly but cannot be checked out. */
    checkoutEnabled: boolean;
    /** When false, plan is withheld from the public pricing catalog. */
    publicVisible: boolean;
    description: string;
}

/**
 * Authoritative server-side crypto catalog definition matching community plans.
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
        checkoutEnabled: true,
        publicVisible: true,
        description: 'Starter Bot (One-time setup & activation payment)',
    },
    'growth-bot': {
        planKey: 'growth-bot',
        planName: 'Growth Bot + Care',
        priceAmountDecimal: '997.00',
        priceCurrency: 'usd',
        billingMode: 'one_time',
        isActive: true,
        checkoutEnabled: true,
        publicVisible: true,
        description: 'Growth Bot + Care (One-time setup fee payment)',
    },
    'pro-automation': {
        planKey: 'pro-automation',
        planName: 'Pro Automation Suite',
        priceAmountDecimal: '1997.00',
        priceCurrency: 'usd',
        billingMode: 'one_time',
        isActive: true,
        checkoutEnabled: true,
        publicVisible: true,
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
 * Resolves the authoritative plan price and configuration from CMS fees.
 * Rejects checkout when sale policy reports the plan is not checkout-eligible
 * (missing catalog entry, inactive CMS row, disabled checkout, or no positive payable amount).
 */
export async function getPlanPrice(
    db: DrizzleDB,
    planKey: string,
    priceCurrencyOverride?: string,
): Promise<PlanPrice | null> {
    const staticConfig = SERVER_CRYPTO_CATALOG[planKey];
    if (!staticConfig) {
        return null;
    }

    const rows = await db
        .select()
        .from(schema.pricingPlans)
        .where(eq(schema.pricingPlans.id, planKey))
        .limit(1);

    const dbPlan = rows[0];
    const sale = evaluatePlanSale({ planKey, planRow: dbPlan ?? null });
    if (!sale.checkoutEligible || !sale.checkoutAmountDecimal) {
        return null;
    }

    const currency = (priceCurrencyOverride ?? staticConfig.priceCurrency).toLowerCase();

    return {
        planKey: staticConfig.planKey,
        planName: dbPlan?.name ?? staticConfig.planName,
        priceAmountDecimal: sale.checkoutAmountDecimal,
        priceCurrency: currency,
        billingMode: staticConfig.billingMode,
        description: `${dbPlan?.name ?? staticConfig.planName} (One-time payment)`,
    };
}
