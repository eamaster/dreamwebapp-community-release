import { describe, expect, it } from 'vitest';
import { adminPlanPriceSummary } from '../admin-plan-summary';

describe('admin plan price summary', () => {
    it('uses the CMS monthly/access price when setup fee is absent', () => {
        expect(adminPlanPriceSummary({ monthlyPrice: 29, setupFee: null })).toBe(
            'Checkout $29.00. Ongoing access $29.00/month, arranged separately.',
        );
    });

    it('prefers a positive setup fee for checkout while keeping ongoing access distinct', () => {
        expect(adminPlanPriceSummary({ monthlyPrice: 29, setupFee: 37.25 })).toBe(
            'Checkout $37.25. Ongoing access $29.00/month, arranged separately.',
        );
        expect(adminPlanPriceSummary({ monthlyPrice: 29, setupFee: 0 })).toBe(
            'Checkout $29.00. Ongoing access $29.00/month, arranged separately.',
        );
    });

    it('reports when checkout amount is not set without inventing a seed price', () => {
        expect(adminPlanPriceSummary({ monthlyPrice: 0, setupFee: null })).toBe(
            'Checkout amount not set. Ongoing access $0.00/month, arranged separately.',
        );
    });
});
