/**
 * Authoritative Server-Owned Cryptocurrency Allowlist and Policy Catalog
 *
 * Rules:
 *  - Single source of truth for approved crypto payment assets in DreamWebApp.
 *  - Machine codes are canonical lowercase strings matching NOWPayments provider identifiers.
 *  - Display metadata (symbol, name, network, label, category, sortOrder) is strictly server-owned.
 *  - Only the intersection of this allowlist and the provider's active available currencies
 *    is returned to the public checkout UI and accepted for checkout creation.
 */

export type CurrencyCategory = 'popular' | 'stablecoins';

export interface ApprovedCurrencyConfig {
    /** Canonical lowercase machine code expected by NOWPayments (e.g. "btc", "usdttrc20", "bnbbsc") */
    readonly code: string;
    /** Uppercase ticker symbol for display (e.g. "BTC", "USDTTRX") */
    readonly symbol: string;
    /** Human-readable asset name (e.g. "Bitcoin", "Tether USD") */
    readonly name: string;
    /** Blockchain network name where applicable (e.g. "Tron", "Ethereum", "BSC", "Polygon") */
    readonly network?: string;
    /** Full presentation label */
    readonly label: string;
    /** Visual category grouping for the checkout UI */
    readonly category: CurrencyCategory;
    /** Authoritative display order */
    readonly sortOrder: number;
}

export interface PaymentCurrencyPublicItem {
    readonly code: string;
    readonly symbol: string;
    readonly name: string;
    readonly network?: string;
    readonly label: string;
    readonly category: CurrencyCategory;
}

/**
 * The approved central cryptocurrency catalog for DreamWebApp.
 *
 * Requested allowlist specification:
 * Popular coins:
 *  - BTC — Bitcoin
 *  - ETH — Ethereum
 *  - LTC — Litecoin
 *  - TRX — Tron
 *  - TON — Gram (ex Ton/TonCoin)
 *  - BNBBSC — Binance Coin (BSC)
 *
 * Stablecoins:
 *  - USDTTRX — Tether USD (Tron)
 *  - TUSDETH — TrueUSD
 *  - USDTETH — Tether USD (Ethereum)
 *  - USDCETH — USD Coin (Ethereum)
 *  - USDPETH — Pax Dollar
 *  - USDTBSC — Tether USD (BSC)
 *  - USDCPOLYGON — USD Coin (Polygon)
 *  - USDDTRX — USDD (TRC20)
 *  - USDCAVAXC — USD Coin (AVAX C-CHAIN)
 *  - USDTAVAXC — Tether (AVAX C-CHAIN)
 *  - USDCALGO — USD Coin (Algorand)
 *  - DAIARB — DAI (Arbitrum)
 *  - USDCSOLANA — USD Coin (Solana)
 *  - USDTARB — Tether (Arbitrum One)
 *  - PYUSDETH — PayPal USD
 *  - FDUSDETH — First Digital USD
 *  - TUSDTRX — TrueUSD (Tron)
 *  - USDCBSC — USD Coin (Binance Smart Chain)
 *  - USDTOP — Tether USD (Optimism)
 *  - USDTPOLYGON — Tether USD (Polygon)
 *  - FDUSDBSC — First Digital USD (Binance Smart Chain)
 *  - USDCARB — USD Coin (Arbitrum One)
 *  - USDCOP — USD Coin (Optimism)
 *  - USDTCELO — Tether USD (CELO)
 *  - USDTTON — Tether USD (TON)
 */
export const APPROVED_CURRENCY_CATALOG: readonly ApprovedCurrencyConfig[] = [
    // ─── Popular coins ────────────────────────────────────────────────────────
    {
        code: 'btc',
        symbol: 'BTC',
        name: 'Bitcoin',
        label: 'Bitcoin · BTC',
        category: 'popular',
        sortOrder: 1,
    },
    {
        code: 'eth',
        symbol: 'ETH',
        name: 'Ethereum',
        label: 'Ethereum · ETH',
        category: 'popular',
        sortOrder: 2,
    },
    {
        code: 'ltc',
        symbol: 'LTC',
        name: 'Litecoin',
        label: 'Litecoin · LTC',
        category: 'popular',
        sortOrder: 3,
    },
    {
        code: 'trx',
        symbol: 'TRX',
        name: 'Tron',
        label: 'Tron · TRX',
        category: 'popular',
        sortOrder: 4,
    },
    {
        code: 'ton',
        symbol: 'TON',
        name: 'Gram (ex Ton/TonCoin)',
        label: 'Gram (ex Ton/TonCoin) · TON',
        category: 'popular',
        sortOrder: 5,
    },
    {
        code: 'bnbbsc',
        symbol: 'BNBBSC',
        name: 'Binance Coin (BSC)',
        network: 'BSC',
        label: 'Binance Coin (BSC) · BNBBSC',
        category: 'popular',
        sortOrder: 6,
    },

    // ─── Stablecoins ──────────────────────────────────────────────────────────
    {
        code: 'usdttrx',
        symbol: 'USDTTRX',
        name: 'Tether USD (Tron)',
        network: 'Tron',
        label: 'Tether USD (Tron) · USDTTRX',
        category: 'stablecoins',
        sortOrder: 7,
    },
    {
        code: 'tusdeth',
        symbol: 'TUSDETH',
        name: 'TrueUSD',
        network: 'Ethereum',
        label: 'TrueUSD · TUSDETH',
        category: 'stablecoins',
        sortOrder: 8,
    },
    {
        code: 'usdteth',
        symbol: 'USDTETH',
        name: 'Tether USD (Ethereum)',
        network: 'Ethereum',
        label: 'Tether USD (Ethereum) · USDTETH',
        category: 'stablecoins',
        sortOrder: 9,
    },
    {
        code: 'usdceth',
        symbol: 'USDCETH',
        name: 'USD Coin (Ethereum)',
        network: 'Ethereum',
        label: 'USD Coin (Ethereum) · USDCETH',
        category: 'stablecoins',
        sortOrder: 10,
    },
    {
        code: 'usdpeth',
        symbol: 'USDPETH',
        name: 'Pax Dollar',
        network: 'Ethereum',
        label: 'Pax Dollar · USDPETH',
        category: 'stablecoins',
        sortOrder: 11,
    },
    {
        code: 'usdtbsc',
        symbol: 'USDTBSC',
        name: 'Tether USD (BSC)',
        network: 'BSC',
        label: 'Tether USD (BSC) · USDTBSC',
        category: 'stablecoins',
        sortOrder: 12,
    },
    {
        code: 'usdcpolygon',
        symbol: 'USDCPOLYGON',
        name: 'USD Coin (Polygon)',
        network: 'Polygon',
        label: 'USD Coin (Polygon) · USDCPOLYGON',
        category: 'stablecoins',
        sortOrder: 13,
    },
    {
        code: 'usddtrx',
        symbol: 'USDDTRX',
        name: 'USDD (TRC20)',
        network: 'TRC20',
        label: 'USDD (TRC20) · USDDTRX',
        category: 'stablecoins',
        sortOrder: 14,
    },
    {
        code: 'usdcavaxc',
        symbol: 'USDCAVAXC',
        name: 'USD Coin (AVAX C-CHAIN)',
        network: 'AVAX C-CHAIN',
        label: 'USD Coin (AVAX C-CHAIN) · USDCAVAXC',
        category: 'stablecoins',
        sortOrder: 15,
    },
    {
        code: 'usdtavaxc',
        symbol: 'USDTAVAXC',
        name: 'Tether (AVAX C-CHAIN)',
        network: 'AVAX C-CHAIN',
        label: 'Tether (AVAX C-CHAIN) · USDTAVAXC',
        category: 'stablecoins',
        sortOrder: 16,
    },
    {
        code: 'usdcalgo',
        symbol: 'USDCALGO',
        name: 'USD Coin (Algorand)',
        network: 'Algorand',
        label: 'USD Coin (Algorand) · USDCALGO',
        category: 'stablecoins',
        sortOrder: 17,
    },
    {
        code: 'daiarb',
        symbol: 'DAIARB',
        name: 'DAI (Arbitrum)',
        network: 'Arbitrum',
        label: 'DAI (Arbitrum) · DAIARB',
        category: 'stablecoins',
        sortOrder: 18,
    },
    {
        code: 'usdcsolana',
        symbol: 'USDCSOLANA',
        name: 'USD Coin (Solana)',
        network: 'Solana',
        label: 'USD Coin (Solana) · USDCSOLANA',
        category: 'stablecoins',
        sortOrder: 19,
    },
    {
        code: 'usdtarb',
        symbol: 'USDTARB',
        name: 'Tether (Arbitrum One)',
        network: 'Arbitrum One',
        label: 'Tether (Arbitrum One) · USDTARB',
        category: 'stablecoins',
        sortOrder: 20,
    },
    {
        code: 'pyusdeth',
        symbol: 'PYUSDETH',
        name: 'PayPal USD',
        network: 'Ethereum',
        label: 'PayPal USD · PYUSDETH',
        category: 'stablecoins',
        sortOrder: 21,
    },
    {
        code: 'fdusdeth',
        symbol: 'FDUSDETH',
        name: 'First Digital USD',
        network: 'Ethereum',
        label: 'First Digital USD · FDUSDETH',
        category: 'stablecoins',
        sortOrder: 22,
    },
    {
        code: 'tusdtrx',
        symbol: 'TUSDTRX',
        name: 'TrueUSD (Tron)',
        network: 'Tron',
        label: 'TrueUSD (Tron) · TUSDTRX',
        category: 'stablecoins',
        sortOrder: 23,
    },
    {
        code: 'usdcbsc',
        symbol: 'USDCBSC',
        name: 'USD Coin (Binance Smart Chain)',
        network: 'Binance Smart Chain',
        label: 'USD Coin (Binance Smart Chain) · USDCBSC',
        category: 'stablecoins',
        sortOrder: 24,
    },
    {
        code: 'usdtop',
        symbol: 'USDTOP',
        name: 'Tether USD (Optimism)',
        network: 'Optimism',
        label: 'Tether USD (Optimism) · USDTOP',
        category: 'stablecoins',
        sortOrder: 25,
    },
    {
        code: 'usdtpolygon',
        symbol: 'USDTPOLYGON',
        name: 'Tether USD (Polygon)',
        network: 'Polygon',
        label: 'Tether USD (Polygon) · USDTPOLYGON',
        category: 'stablecoins',
        sortOrder: 26,
    },
    {
        code: 'fdusdbsc',
        symbol: 'FDUSDBSC',
        name: 'First Digital USD (Binance Smart Chain)',
        network: 'Binance Smart Chain',
        label: 'First Digital USD (Binance Smart Chain) · FDUSDBSC',
        category: 'stablecoins',
        sortOrder: 27,
    },
    {
        code: 'usdcarb',
        symbol: 'USDCARB',
        name: 'USD Coin (Arbitrum One)',
        network: 'Arbitrum One',
        label: 'USD Coin (Arbitrum One) · USDCARB',
        category: 'stablecoins',
        sortOrder: 28,
    },
    {
        code: 'usdcop',
        symbol: 'USDCOP',
        name: 'USD Coin (Optimism)',
        network: 'Optimism',
        label: 'USD Coin (Optimism) · USDCOP',
        category: 'stablecoins',
        sortOrder: 29,
    },
    {
        code: 'usdtcelo',
        symbol: 'USDTCELO',
        name: 'Tether USD (CELO)',
        network: 'CELO',
        label: 'Tether USD (CELO) · USDTCELO',
        category: 'stablecoins',
        sortOrder: 30,
    },
    {
        code: 'usdtton',
        symbol: 'USDTTON',
        name: 'Tether USD (TON)',
        network: 'TON',
        label: 'Tether USD (TON) · USDTTON',
        category: 'stablecoins',
        sortOrder: 31,
    },
] as const;

/** Quick-lookup map and set for allowlist validation */
export const APPROVED_CURRENCY_MAP = new Map<string, ApprovedCurrencyConfig>(
    APPROVED_CURRENCY_CATALOG.map((c) => [c.code, c]),
);

export const APPROVED_CURRENCY_CODES: ReadonlySet<string> = new Set<string>(
    APPROVED_CURRENCY_CATALOG.map((c) => c.code),
);

/**
 * Checks whether a given machine currency code is part of the central allowlist.
 */
export function isApprovedCurrency(code?: string | null): boolean {
    if (!code) return false;
    return APPROVED_CURRENCY_CODES.has(code.trim().toLowerCase());
}

/**
 * Resolves full metadata for an approved currency code, or undefined if not allowlisted.
 */
export function getApprovedCurrency(code?: string | null): ApprovedCurrencyConfig | undefined {
    if (!code) return undefined;
    return APPROVED_CURRENCY_MAP.get(code.trim().toLowerCase());
}

/**
 * Computes the ordered intersection of the central allowlist and the provider's
 * currently available currency codes. Preserves the catalog's authoritative sort order
 * and returns sanitized public DTOs.
 */
export function filterAndOrderApprovedCurrencies(
    availableProviderCodes: readonly string[],
): PaymentCurrencyPublicItem[] {
    const availableSet = new Set(
        availableProviderCodes.map((c) => c.trim().toLowerCase()),
    );

    const result: PaymentCurrencyPublicItem[] = [];

    for (const item of APPROVED_CURRENCY_CATALOG) {
        if (availableSet.has(item.code)) {
            result.push({
                code: item.code,
                symbol: item.symbol,
                name: item.name,
                network: item.network,
                label: item.label,
                category: item.category,
            });
        }
    }

    return result;
}
