/**
 * Shared CMS checkout-amount selection.
 *
 * Public display, checkout, and admin summaries must pick the same fee from
 * pricing_plans -- never a deploy-time catalog seed.
 *
 * Rule: a positive setup fee is the activation charge; otherwise the CMS
 * monthly / access price is used (same for open-ended and fixed-access plans).
 */

export function selectCmsCheckoutFee(input: {
    setupFee?: number | null;
    monthlyPrice?: number | null;
}): number | null | undefined {
    const setup = Number(input.setupFee ?? 0);
    return setup > 0 ? input.setupFee : input.monthlyPrice;
}
