/**
 * Frontend configuration of plans eligible for cryptocurrency checkout.
 * Strictly synchronized with the Worker's authoritative SERVER_CRYPTO_CATALOG.
 */

export const SUPPORTED_CRYPTO_PLAN_KEYS: ReadonlySet<string> = new Set<string>([
    'starter-bot',
    'growth-bot',
    'pro-automation',
]);

/**
 * Checks whether a given plan ID has an active, explicit server-side crypto configuration.
 */
export function isCryptoCheckoutSupported(planId?: string | null): boolean {
    if (!planId) return false;
    return SUPPORTED_CRYPTO_PLAN_KEYS.has(planId.trim().toLowerCase());
}
