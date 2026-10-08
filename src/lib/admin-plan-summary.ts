import { selectCmsCheckoutFee } from '@shared/cms-checkout-amount';
import { CATALOG_DISPLAY_CURRENCY, formatMoneyAmount } from '@shared/monetary-display';

/**
 * Admin labels for the two persisted plan amounts.
 * Checkout uses the same CMS fee selection as public sale / crypto checkout.
 * Ongoing access is the CMS monthly price and is not collected automatically.
 */

export function formatAdminMoney(amount: number): string {
    return formatMoneyAmount(amount.toFixed(2), CATALOG_DISPLAY_CURRENCY);
}

export function adminCheckoutAmountLabel(plan: {
    setupFee?: number | null;
    monthlyPrice: number;
}): string {
    const fee = selectCmsCheckoutFee(plan);
    if (fee == null || !Number.isFinite(Number(fee)) || Number(fee) <= 0) {
        return 'Checkout amount not set';
    }
    return `Checkout ${formatAdminMoney(Number(fee))}`;
}

export function adminOngoingAccessLabel(monthlyPrice: number): string {
    return `Ongoing access ${formatAdminMoney(monthlyPrice)}/month, arranged separately`;
}

export function adminPlanPriceSummary(plan: {
    setupFee?: number | null;
    monthlyPrice: number;
}): string {
    return `${adminCheckoutAmountLabel(plan)}. ${adminOngoingAccessLabel(plan.monthlyPrice)}.`;
}
