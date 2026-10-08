/**
 * Shared platform-neutral checkout route builder.
 * Authoritative single source of truth for both frontend and Worker.
 */

export function buildCryptoCheckoutPath(planId: string): string {
    return `/checkout/crypto?plan=${encodeURIComponent(planId)}`;
}

/** Frontend alias preserving existing naming convention. */
export const cryptoCheckoutTo = buildCryptoCheckoutPath;
