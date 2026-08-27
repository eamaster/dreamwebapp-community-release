/**
 * International phone helpers built entirely on `libphonenumber-js` metadata
 * and the browser's built-in `Intl.DisplayNames` — no hardcoded
 * country/calling-code list.
 */

import {
    getCountries,
    getCountryCallingCode,
    parsePhoneNumberFromString,
    isValidPhoneNumber,
    type CountryCode,
} from 'libphonenumber-js';

export interface CountryOption {
    code: CountryCode;
    name: string;
    callingCode: string;
}

let cachedCountryOptions: CountryOption[] | null = null;

/** All ISO countries known to libphonenumber-js, with display names and calling codes, sorted by name. */
export function getCountryOptions(): CountryOption[] {
    if (cachedCountryOptions) return cachedCountryOptions;

    const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
        ? new Intl.DisplayNames(['en'], { type: 'region' })
        : null;

    cachedCountryOptions = getCountries()
        .map((code) => ({
            code,
            name: regionNames?.of(code) ?? code,
            callingCode: getCountryCallingCode(code),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return cachedCountryOptions;
}

/** Combines a country + national-format number into a single E.164 string, or null if invalid. */
export function toE164(country: CountryCode, nationalNumber: string): string | null {
    const parsed = parsePhoneNumberFromString(nationalNumber, country);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.number;
}

/** Best-effort international display format; falls back to the raw stored value if unparseable. */
export function formatPhoneDisplay(e164: string | null | undefined): string | null {
    if (!e164) return null;
    const parsed = parsePhoneNumberFromString(e164);
    return parsed?.isValid() ? parsed.formatInternational() : e164;
}

/** Safe `tel:` href — uses the raw stored value as a fallback so a link is never dropped outright. */
export function toTelHref(e164: string | null | undefined): string | null {
    if (!e164) return null;
    const parsed = parsePhoneNumberFromString(e164);
    return `tel:${parsed?.isValid() ? parsed.number : e164}`;
}

/** Splits a stored E.164 value back into country + national number for editing, when parseable. */
export function splitE164(e164: string | null | undefined): { country: CountryCode; nationalNumber: string } | null {
    if (!e164) return null;
    const parsed = parsePhoneNumberFromString(e164);
    if (!parsed || !parsed.country) return null;
    return { country: parsed.country, nationalNumber: parsed.formatNational() };
}

export { isValidPhoneNumber };
export type { CountryCode };
