/**
 * Community-slim sale policy for public listing and crypto checkout.
 *
 * Distinguishes:
 *   - CMS `isActive` (operator content state)
 *   - catalog `publicVisible` (approved for public listing)
 *   - catalog `checkoutEnabled` (approved for crypto checkout)
 *   - payable CMS amount (positive checkout fee required to charge)
 *
 * Does NOT include upstream product launch gates, founding-pilot config, or
 * service↔plan commercial mappings (those modules are out of community scope).
 */

import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '../../db';
import * as schema from '../../db/schema';
import { SERVER_CRYPTO_CATALOG } from '../payments/catalog';
import { resolvePlanCheckoutAmountDecimal } from './cms-plan-amounts';

export type PlanSaleCode =
    | 'eligible'
    | 'not_in_catalog'
    | 'catalog_inactive'
    | 'catalog_not_public'
    | 'checkout_disabled'
    | 'plan_missing'
    | 'plan_inactive'
    | 'no_payable_amount';

export interface PlanSaleDecision {
    planKey: string;
    /** True when the plan may be sold via crypto checkout right now. */
    checkoutEligible: boolean;
    /** True when the plan may appear on the public pricing catalog. */
    publicVisible: boolean;
    code: PlanSaleCode;
    reason: string;
    /** Exact amount checkout would collect; null when not resolvable. */
    checkoutAmountDecimal: string | null;
}

export interface PlanSaleInputs {
    planKey: string;
    planRow?: schema.PricingPlanRow | null;
}

function decision(
    planKey: string,
    code: PlanSaleCode,
    reason: string,
    extra: Partial<Pick<PlanSaleDecision, 'checkoutAmountDecimal' | 'publicVisible' | 'checkoutEligible'>> = {},
): PlanSaleDecision {
    return {
        planKey,
        checkoutEligible: extra.checkoutEligible ?? false,
        publicVisible: extra.publicVisible ?? false,
        code,
        reason,
        checkoutAmountDecimal: extra.checkoutAmountDecimal ?? null,
    };
}

/**
 * Pure evaluation over an already-loaded CMS row.
 * Public visibility and checkout eligibility are reported separately.
 */
export function evaluatePlanSale(input: PlanSaleInputs): PlanSaleDecision {
    const { planKey, planRow } = input;
    const catalog = SERVER_CRYPTO_CATALOG[planKey];

    if (!catalog) {
        return decision(planKey, 'not_in_catalog', 'Plan has no server checkout configuration');
    }
    if (!catalog.isActive) {
        return decision(planKey, 'catalog_inactive', 'Plan is inactive in the server catalog');
    }
    if (!planRow) {
        return decision(planKey, 'plan_missing', 'No CMS pricing plan record exists');
    }
    if (!planRow.isActive) {
        return decision(planKey, 'plan_inactive', 'CMS pricing plan record is inactive');
    }

    const amount = resolvePlanCheckoutAmountDecimal({
        setupFee: planRow.setupFee,
        monthlyPrice: planRow.monthlyPrice,
    });
    const hasPositivePayable = amount != null && Number(amount) > 0;

    const publiclyListed = catalog.publicVisible !== false;
    if (!publiclyListed) {
        return decision(planKey, 'catalog_not_public', 'Plan is not approved for public listing', {
            checkoutAmountDecimal: amount,
        });
    }

    if (catalog.checkoutEnabled === false) {
        return decision(planKey, 'checkout_disabled', 'Checkout is disabled for this plan', {
            publicVisible: true,
            checkoutAmountDecimal: amount,
        });
    }

    if (!hasPositivePayable) {
        return decision(planKey, 'no_payable_amount', 'Checkout would collect no payment', {
            publicVisible: true,
            checkoutAmountDecimal: amount,
        });
    }

    return decision(planKey, 'eligible', 'Eligible for public sale', {
        publicVisible: true,
        checkoutEligible: true,
        checkoutAmountDecimal: amount,
    });
}

/** Evaluate sale policy for a single plan key (loads the CMS row). */
export async function evaluatePlanSaleForKey(
    db: DrizzleDB,
    planKey: string,
): Promise<PlanSaleDecision> {
    const rows = await db
        .select()
        .from(schema.pricingPlans)
        .where(eq(schema.pricingPlans.id, planKey))
        .limit(1);

    return evaluatePlanSale({ planKey, planRow: rows[0] ?? null });
}
