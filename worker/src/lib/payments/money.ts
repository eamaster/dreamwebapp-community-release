/**
 * Decimal-safe monetary arithmetic and validation helpers.
 *
 * Avoids JavaScript IEEE 754 floating-point inaccuracies by parsing
 * and comparing monetary amounts as scaled integer / bigint strings.
 */

/**
 * Normalizes an amount into a standardized decimal string with a fixed precision.
 * @param amount Number or decimal string (e.g. 299, "299", "299.50")
 * @param minDecimals Minimum fractional digits (default 2 for fiat, higher for crypto)
 */
export function normalizeDecimalString(amount: number | string, minDecimals = 2): string {
    if (typeof amount === 'number') {
        if (!Number.isFinite(amount) || isNaN(amount)) {
            throw new Error(`Invalid monetary amount: ${amount}`);
        }
        // Format to fixed string with reasonable decimal bounds
        const parts = amount.toFixed(8).split('.');
        const whole = parts[0] ?? '0';
        let fraction = parts[1] ?? '0';
        // Trim trailing zeros beyond minDecimals
        while (fraction.length > minDecimals && fraction.endsWith('0')) {
            fraction = fraction.slice(0, -1);
        }
        while (fraction.length < minDecimals) {
            fraction += '0';
        }
        return `${whole}.${fraction}`;
    }

    const trimmed = amount.trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
        throw new Error(`Invalid monetary decimal string: "${amount}"`);
    }

    const [whole = '0', rawFraction = ''] = trimmed.split('.');
    let fraction = rawFraction;
    while (fraction.length < minDecimals) {
        fraction += '0';
    }
    return `${whole}.${fraction}`;
}

/**
 * Converts a decimal string to a scaled BigInt given a target scale (number of decimals).
 * e.g. "299.50" with scale 8 -> 29950000000n
 */
function toScaledBigInt(decimalStr: string, scale: number): bigint {
    const trimmed = decimalStr.trim();
    const isNegative = trimmed.startsWith('-');
    const clean = isNegative ? trimmed.slice(1) : trimmed;
    const [whole = '0', rawFraction = ''] = clean.split('.');
    const fraction = rawFraction.slice(0, scale).padEnd(scale, '0');
    const combined = `${whole}${fraction}`;
    const value = BigInt(combined);
    return isNegative ? -value : value;
}

/**
 * Compares two decimal strings safely without floating point conversion.
 * Returns:
 *   -1 if a < b
 *    0 if a === b
 *    1 if a > b
 */
export function compareDecimalStrings(a: string, b: string, scale = 8): number {
    const bigA = toScaledBigInt(a, scale);
    const bigB = toScaledBigInt(b, scale);
    if (bigA < bigB) return -1;
    if (bigA > bigB) return 1;
    return 0;
}

/**
 * Validates whether the received amount is sufficient compared to expected amount,
 * allowing a configurable tolerance policy (default: 0% - exact or greater).
 *
 * @param received Decimal string or number from IPN
 * @param expected Decimal string or number from Order record
 * @param toleranceFraction Fraction allowable underpayment (e.g. 0.01 = 1% tolerance, 0 = exact)
 */
export function isPaymentAmountSufficient(
    received: string | number,
    expected: string | number,
    toleranceFraction = 0.0,
): boolean {
    const recStr = typeof received === 'number' ? normalizeDecimalString(received, 8) : received;
    const expStr = typeof expected === 'number' ? normalizeDecimalString(expected, 8) : expected;

    const scale = 8;
    const recBig = toScaledBigInt(recStr, scale);
    const expBig = toScaledBigInt(expStr, scale);

    if (toleranceFraction <= 0) {
        return recBig >= expBig;
    }

    // Minimum acceptable = expected * (1 - toleranceFraction)
    // using integer arithmetic: expBig * BigInt(Math.round((1 - toleranceFraction) * 10000)) / 10000n
    const multiplier = BigInt(Math.floor((1 - toleranceFraction) * 10000));
    const minAcceptable = (expBig * multiplier) / 10000n;

    return recBig >= minAcceptable;
}

/**
 * Validates that two currency codes match (case-insensitive, trimmed).
 */
export function isCurrencyMatch(a?: string | null, b?: string | null): boolean {
    if (!a || !b) return false;
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Safely sums an array of decimal strings using BigInt arithmetic.
 * Never uses floating-point Number(), parseFloat(), or toFixed().
 *
 * @param amounts Array of decimal strings (e.g. ["299.00", "997.00"])
 * @param decimals Output fractional decimal places (default 2)
 */
export function sumDecimalStrings(amounts: string[], decimals = 2): string {
    const scale = 8;
    let total = 0n;

    for (const amt of amounts) {
        if (!amt || typeof amt !== 'string') continue;
        try {
            const normalized = normalizeDecimalString(amt.trim(), scale);
            total += toScaledBigInt(normalized, scale);
        } catch {
            // Skip unparseable values safely without crashing
        }
    }

    const isNegative = total < 0n;
    const absTotal = isNegative ? -total : total;
    const scaleDivisor = 10n ** BigInt(scale);
    const whole = absTotal / scaleDivisor;
    const fractionBig = absTotal % scaleDivisor;
    const fractionStr = fractionBig.toString().padStart(scale, '0').slice(0, decimals);

    return `${isNegative ? '-' : ''}${whole.toString()}.${fractionStr.padEnd(decimals, '0')}`;
}
