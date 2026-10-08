import { describe, expect, it } from 'vitest';
import {
    buildManualArrangementDisclosure,
    resolveCheckoutAmountDecimal,
    resolveMonthlyAmountDecimal,
    resolvePlanCheckoutAmountDecimal,
} from '../cms-plan-amounts';

describe('cms-plan-amounts', () => {
    it('resolves checkout amount from a saved fee, including an explicit zero', () => {
        expect(resolveCheckoutAmountDecimal(29)).toBe('29.00');
        expect(resolveCheckoutAmountDecimal(37.25)).toBe('37.25');
        expect(resolveCheckoutAmountDecimal(0)).toBe('0.00');
    });

    it('does not replace a missing or invalid fee with a deploy-time seed', () => {
        expect(resolveCheckoutAmountDecimal(null)).toBeNull();
        expect(resolveCheckoutAmountDecimal(undefined)).toBeNull();
        expect(resolveCheckoutAmountDecimal(Number.NaN)).toBeNull();
        expect(resolveCheckoutAmountDecimal(-1)).toBeNull();
    });

    it('uses a positive setup fee, otherwise the CMS monthly/access price, for every plan shape', () => {
        expect(
            resolvePlanCheckoutAmountDecimal({ setupFee: 37.25, monthlyPrice: 29 }),
        ).toBe('37.25');
        expect(
            resolvePlanCheckoutAmountDecimal({ setupFee: null, monthlyPrice: 29 }),
        ).toBe('29.00');
        expect(
            resolvePlanCheckoutAmountDecimal({ setupFee: 0, monthlyPrice: 19 }),
        ).toBe('19.00');
        expect(
            resolvePlanCheckoutAmountDecimal({
                fixedAccessDays: 30,
                setupFee: null,
                monthlyPrice: 29,
            }),
        ).toBe('29.00');
        expect(
            resolvePlanCheckoutAmountDecimal({ setupFee: null, monthlyPrice: null }),
        ).toBeNull();
        expect(
            resolvePlanCheckoutAmountDecimal({ setupFee: 0, monthlyPrice: 0 }),
        ).toBe('0.00');
    });

    it('resolves monthly amount from CMS and builds disclosure without hardcoding', () => {
        expect(resolveMonthlyAmountDecimal(19)).toBe('19.00');
        expect(buildManualArrangementDisclosure('19.00')).toBe(
            'Ongoing platform access is $19/month and arranged separately.',
        );
        expect(resolveMonthlyAmountDecimal(0)).toBeNull();
        expect(resolveMonthlyAmountDecimal(null)).toBeNull();
        expect(resolveMonthlyAmountDecimal(undefined)).toBeNull();
    });
});
