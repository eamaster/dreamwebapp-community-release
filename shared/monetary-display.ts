/**
 * Shared platform-neutral monetary display formatter.
 * Authoritative single source of truth for both frontend and Worker.
 */

export interface StructuredDisplayPrice {
    amountDecimal: string;
    currency: string;
    label: string;
}

export interface StructuredMonthlyTerm {
    amountDecimal: string | null;
    currency: string;
    collectionState: 'manual_arrangement' | 'not_offered';
    disclosure: string | null;
    /** Interval the amount applies to, e.g. "month" (default) or "30 days". */
    periodLabel?: string;
}

/**
 * Display currency of the server crypto catalog (`priceCurrency: 'usd'`).
 */
export const CATALOG_DISPLAY_CURRENCY = 'usd';

/** Formats a decimal string amount as currency, without any label. */
export function formatMoneyAmount(amountDecimal: string, currency: string, locale = 'en-US'): string {
    try {
        const num = Number(amountDecimal);
        if (!isNaN(num)) {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency.toUpperCase(),
            }).format(num);
        }
    } catch {
        // Fallback below if Intl fails or currency code is non-standard
    }
    const symbol = currency.toLowerCase() === 'usd' ? '$' : `${currency.toUpperCase()} `;
    return `${symbol}${amountDecimal}`;
}

export function formatDisplayPrice(price: StructuredDisplayPrice, locale = 'en-US'): string {
    return `${formatMoneyAmount(price.amountDecimal, price.currency, locale)} ${price.label}`;
}
