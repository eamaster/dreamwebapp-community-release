import { describe, expect, it } from 'vitest';
import { evaluatePlanSale } from '../plan-sale-policy';
import type { PricingPlanRow } from '../../../db/schema';

function planRow(overrides: Partial<PricingPlanRow> = {}): PricingPlanRow {
    return {
        id: 'starter-bot',
        name: 'Starter Bot',
        description: 'Test',
        monthlyPrice: 197,
        setupFee: 997,
        badge: null,
        isHighlighted: false,
        bestFor: 'Testing',
        ctaText: 'Buy',
        featuresJson: '[]',
        isActive: true,
        sortOrder: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

describe('community plan-sale-policy', () => {
    it('marks a CMS-active catalog plan with a positive setup fee as checkout-eligible', () => {
        const decision = evaluatePlanSale({ planKey: 'starter-bot', planRow: planRow() });
        expect(decision.publicVisible).toBe(true);
        expect(decision.checkoutEligible).toBe(true);
        expect(decision.checkoutAmountDecimal).toBe('997.00');
        expect(decision.code).toBe('eligible');
    });

    it('uses CMS monthly/access price when setup fee is absent or zero', () => {
        const absent = evaluatePlanSale({
            planKey: 'growth-bot',
            planRow: planRow({ id: 'growth-bot', setupFee: null, monthlyPrice: 197 }),
        });
        expect(absent.checkoutEligible).toBe(true);
        expect(absent.checkoutAmountDecimal).toBe('197.00');

        const zeroSetup = evaluatePlanSale({
            planKey: 'growth-bot',
            planRow: planRow({ id: 'growth-bot', setupFee: 0, monthlyPrice: 197 }),
        });
        expect(zeroSetup.checkoutEligible).toBe(true);
        expect(zeroSetup.checkoutAmountDecimal).toBe('197.00');
    });

    it('does not treat CMS active alone as publicly sellable when the plan is not in the catalog', () => {
        const decision = evaluatePlanSale({
            planKey: 'custom-only-plan',
            planRow: planRow({ id: 'custom-only-plan', isActive: true }),
        });
        expect(decision.publicVisible).toBe(false);
        expect(decision.checkoutEligible).toBe(false);
        expect(decision.code).toBe('not_in_catalog');
    });

    it('does not list a plan publicly when no positive payable amount exists', () => {
        const decision = evaluatePlanSale({
            planKey: 'starter-bot',
            planRow: planRow({ setupFee: null, monthlyPrice: 0 }),
        });
        expect(decision.publicVisible).toBe(false);
        expect(decision.checkoutEligible).toBe(false);
        expect(decision.code).toBe('no_payable_amount');
    });

    it('rejects checkout when the CMS plan row is inactive', () => {
        const decision = evaluatePlanSale({
            planKey: 'starter-bot',
            planRow: planRow({ isActive: false }),
        });
        expect(decision.checkoutEligible).toBe(false);
        expect(decision.publicVisible).toBe(false);
        expect(decision.code).toBe('plan_inactive');
    });
});
