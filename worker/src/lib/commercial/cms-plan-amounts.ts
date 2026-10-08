/**
 * Runtime plan amount authority for public display and crypto checkout.
 *
 * The chargeable amount is selected from CMS/D1 fees only (see
 * `@shared/cms-checkout-amount`). A missing fee is unavailable, not a request
 * to use a deploy-time seed. Zero is an explicit amount when it is the
 * selected fee.
 */

import { selectCmsCheckoutFee } from '@shared/cms-checkout-amount';
import { normalizeDecimalString } from '../payments/money';

export function resolveCheckoutAmountDecimal(
    setupFee: number | null | undefined,
): string | null {
    if (setupFee == null) return null;
    const amount = Number(setupFee);
    if (!Number.isFinite(amount) || amount < 0) return null;
    return normalizeDecimalString(amount, 2);
}

/**
 * The single amount a plan's checkout collects. Used by the server quote AND by the
 * public presentation so the displayed "due at checkout" can never drift from the charge.
 *
 * Positive CMS setup fee wins; otherwise the CMS monthly/access price is charged.
 * Applies to both open-ended and fixed-access plans so an admin-saved monthly
 * price remains sellable when setup fee was left unset.
 */
export function resolvePlanCheckoutAmountDecimal(input: {
    fixedAccessDays?: number | null;
    setupFee: number | null | undefined;
    monthlyPrice: number | null | undefined;
}): string | null {
    void input.fixedAccessDays;
    return resolveCheckoutAmountDecimal(
        selectCmsCheckoutFee({
            setupFee: input.setupFee,
            monthlyPrice: input.monthlyPrice,
        }),
    );
}

export function resolveMonthlyAmountDecimal(
    monthlyPrice: number | null | undefined,
): string | null {
    if (monthlyPrice == null) return null;
    const amount = Number(monthlyPrice);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return normalizeDecimalString(amount, 2);
}

/** Human-readable manual recurring disclosure from a resolved monthly amount. */
export function buildManualArrangementDisclosure(monthlyAmountDecimal: string | null): string | null {
    if (!monthlyAmountDecimal) return null;
    return `Ongoing platform access is $${prettyAmount(monthlyAmountDecimal)}/month and arranged separately.`;
}

/** Disclosure for a fixed-access product's optional renewal (never charged automatically). */
export function buildFixedAccessRenewalDisclosure(amountDecimal: string, accessDays: number): string {
    return `Access lasts ${accessDays} days. Renewal is $${prettyAmount(amountDecimal)} per ${accessDays} days, arranged separately — nothing renews or charges automatically.`;
}

function prettyAmount(amountDecimal: string): string {
    const n = Number(amountDecimal);
    return Number.isFinite(n) && Number.isInteger(n)
        ? String(n)
        : amountDecimal.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
