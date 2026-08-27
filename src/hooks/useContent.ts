/**
 * React Query hooks for all public content endpoints.
 *
 * Each hook uses `placeholderData` from the static fallback files so the UI
 * renders immediately with the bundled data — the API fetch happens in the
 * background, and the UI updates silently when fresh data arrives.
 *
 * This means:
 *  - Zero loading spinners for content that rarely changes
 *  - Graceful degradation if the Worker API is unreachable
 *  - Content updates are visible within the staleTime window (5 min)
 */

import { useQuery } from '@tanstack/react-query';
import {
    fetchSite,
    fetchServices,
    fetchSolutions,
    fetchPricing,
    fetchFAQ,
    fetchLegalPage,
    type SiteData,
    type ServiceData,
    type SolutionData,
    type PricingData,
    type FAQItem,
} from '@/lib/api-client';

// ─── Static fallback data (former content/*.ts files) ────────────────────────

import { siteContent } from '@/content/fallback/site';
import { services as servicesFallback } from '@/content/fallback/services';
import { solutions as solutionsFallback } from '@/content/fallback/solutions';
import { pricingPlans, addOns } from '@/content/fallback/pricing';
import { faqs as faqsFallback } from '@/content/fallback/faq';

// Shape fallback data to match API response types
const siteFallback: SiteData = {
    brand: siteContent.brand,
    navigation: siteContent.navigation,
    footer: siteContent.footer,
    contact: siteContent.contact,
};

const pricingFallback: PricingData = {
    plans: pricingPlans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        monthlyPrice: p.monthlyPrice,
        setupFee: p.setupFee,
        bestFor: p.bestFor,
        ctaText: p.ctaText,
        badge: p.badge,
        highlighted: p.highlighted,
        features: p.features,
    })),
    addons: addOns.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        price: a.price,
        priceType: a.priceType,
    })),
};

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const QUERY_KEYS = {
    SITE:      ['content', 'site']      as const,
    SERVICES:  ['content', 'services']  as const,
    SOLUTIONS: ['content', 'solutions'] as const,
    PRICING:   ['content', 'pricing']   as const,
    FAQ:       ['content', 'faq']       as const,
    LEGAL:     (id: string) => ['content', 'legal', id] as const,
} as const;

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Site-wide settings: brand, navigation, footer, contact.
 */
export function useSite() {
    return useQuery({
        queryKey: QUERY_KEYS.SITE,
        queryFn: fetchSite,
        placeholderData: siteFallback,
    });
}

/**
 * All active service offerings, ordered by sort_order.
 */
export function useServices() {
    return useQuery({
        queryKey: QUERY_KEYS.SERVICES,
        queryFn: fetchServices,
        placeholderData: servicesFallback as ServiceData[],
    });
}

/**
 * All active industry solutions, ordered by sort_order.
 */
export function useSolutions() {
    return useQuery({
        queryKey: QUERY_KEYS.SOLUTIONS,
        queryFn: fetchSolutions,
        placeholderData: solutionsFallback as SolutionData[],
    });
}

/**
 * Pricing plans and add-ons.
 */
export function usePricing() {
    return useQuery({
        queryKey: QUERY_KEYS.PRICING,
        queryFn: fetchPricing,
        placeholderData: pricingFallback,
    });
}

/**
 * FAQ items, ordered by sort_order.
 */
export function useFAQ() {
    return useQuery({
        queryKey: QUERY_KEYS.FAQ,
        queryFn: fetchFAQ,
        placeholderData: faqsFallback as FAQItem[],
    });
}

/**
 * A single legal page (Privacy Policy / Terms of Service). No fallback data
 * — an unpublished/missing page is a legitimate, neutral state, not an error.
 */
export function useLegalPage(id: 'privacy-policy' | 'terms-of-service') {
    return useQuery({
        queryKey: QUERY_KEYS.LEGAL(id),
        queryFn: () => fetchLegalPage(id),
    });
}
