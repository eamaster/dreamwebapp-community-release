import { useEffect, useMemo, useRef, useState } from 'react';
import { getCountryOptions, toE164, splitE164, type CountryCode, type CountryOption } from '@/lib/phone';

export interface CountryPhoneInputProps {
    /** Current value, canonically E.164 (e.g. "+15551234567") or null/empty for none. */
    value: string | null | undefined;
    onChange: (e164: string | null) => void;
    /** Surfaces "this doesn't look valid yet" without blocking typing — server is authoritative. */
    onValidityChange?: (isValid: boolean) => void;
    /**
     * Visual theme. 'light' matches white form surfaces (public Contact form
     * and the admin white cards). 'dark' is for dark surfaces.
     */
    variant?: 'dark' | 'light';
    /**
     * Prefixes the internal input/button ids. Needed when this component is
     * mounted more than once on the same page (e.g. the standalone contact
     * page and the chat widget's handoff form, which reuses `ContactForm`
     * and is always present in the DOM) so label/id associations stay unique.
     */
    idPrefix?: string;
}

const DEFAULT_COUNTRY: CountryCode = 'US';

const THEME = {
    dark: {
        trigger: 'w-full flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm text-left focus:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500 outline-none',
        input: 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-brand-500 outline-none',
        popover: 'bg-slate-950 border border-slate-800 shadow-xl',
        search: 'w-full bg-slate-900 border-b border-slate-800 px-3 py-2 text-sm text-white outline-none focus:bg-slate-800',
        option: 'text-slate-200',
        optionHighlighted: 'bg-brand-600/25 text-white',
        empty: 'text-slate-500',
        hint: 'text-xs text-amber-400',
        chevron: 'text-slate-500',
    },
    light: {
        trigger: 'w-full flex items-center gap-2 px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 text-sm text-left focus:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500 outline-none',
        input: 'w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none',
        popover: 'bg-white border border-slate-200 shadow-xl',
        search: 'w-full border-b border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:bg-slate-50',
        option: 'text-slate-700',
        optionHighlighted: 'bg-brand-50 text-brand-900',
        empty: 'text-slate-600',
        hint: 'text-xs font-medium text-amber-800',
        chevron: 'text-slate-600',
    },
} as const;

/** Decorative flag from an ISO 3166-1 alpha-2 code via Unicode regional indicators — no image/font dependency. */
function flagEmoji(code: string): string {
    return code
        .toUpperCase()
        .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function matchesQuery(country: CountryOption, query: string): boolean {
    if (!query) return true;
    const q = query.replace(/^\+/, '');
    return (
        country.name.toLowerCase().includes(q) ||
        country.callingCode.includes(q) ||
        country.code.toLowerCase().includes(q)
    );
}

/**
 * Accessible, compact international phone input: a country trigger (flag +
 * name + calling code) that opens a searchable popover listbox, alongside a
 * national-number field. All country names/calling codes come from
 * `libphonenumber-js` metadata and `Intl.DisplayNames` — never a
 * hand-maintained list.
 */
export function CountryPhoneInput({ value, onChange, onValidityChange, variant = 'dark', idPrefix = '' }: CountryPhoneInputProps) {
    const countries = useMemo(() => getCountryOptions(), []);
    const initial = useMemo(() => splitE164(value), [value]);
    const theme = THEME[variant];

    const [country, setCountry] = useState<CountryCode>(initial?.country ?? DEFAULT_COUNTRY);
    const [nationalNumber, setNationalNumber] = useState(initial?.nationalNumber ?? '');
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const selected = useMemo(() => countries.find((c) => c.code === country) ?? null, [countries, country]);

    const filteredCountries = useMemo(() => {
        const q = search.trim().toLowerCase();
        return countries.filter((c) => matchesQuery(c, q));
    }, [countries, search]);

    // Reopening resets the filter and highlights the current selection.
    useEffect(() => {
        if (!open) return;
        setSearch('');
        setHighlightedIndex(Math.max(0, countries.findIndex((c) => c.code === country)));
        const id = window.setTimeout(() => searchInputRef.current?.focus(), 0);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Re-clamp the highlighted option whenever the filtered list changes.
    useEffect(() => {
        setHighlightedIndex((prev) => Math.min(prev, Math.max(0, filteredCountries.length - 1)));
    }, [filteredCountries.length]);

    useEffect(() => {
        if (!open) return;
        const highlighted = listRef.current?.querySelector<HTMLLIElement>(`[data-index="${highlightedIndex}"]`);
        highlighted?.scrollIntoView({ block: 'nearest' });
    }, [open, highlightedIndex]);

    useEffect(() => {
        if (!open) return;
        function onPointerDown(e: MouseEvent) {
            if (!containerRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [open]);

    const emit = (nextCountry: CountryCode, nextNational: string) => {
        if (!nextNational.trim()) {
            onChange(null);
            onValidityChange?.(true);
            return;
        }
        const e164 = toE164(nextCountry, nextNational);
        onChange(e164 ?? nextNational);
        onValidityChange?.(Boolean(e164));
    };

    const closeAndRefocus = () => {
        setOpen(false);
        triggerRef.current?.focus();
    };

    const selectCountry = (next: CountryOption) => {
        setCountry(next.code);
        emit(next.code, nationalNumber);
        closeAndRefocus();
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex((i) => (filteredCountries.length ? (i + 1) % filteredCountries.length : 0));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex((i) => (filteredCountries.length ? (i - 1 + filteredCountries.length) % filteredCountries.length : 0));
                break;
            case 'Home':
                e.preventDefault();
                setHighlightedIndex(0);
                break;
            case 'End':
                e.preventDefault();
                setHighlightedIndex(Math.max(0, filteredCountries.length - 1));
                break;
            case 'Enter': {
                e.preventDefault();
                const match = filteredCountries[highlightedIndex];
                if (match) selectCountry(match);
                break;
            }
            case 'Escape':
                e.preventDefault();
                closeAndRefocus();
                break;
            case 'Tab':
                setOpen(false);
                break;
            default:
                break;
        }
    };

    const triggerId = `${idPrefix}phone-country-trigger`;
    const listboxId = `${idPrefix}phone-country-listbox`;
    const searchId = `${idPrefix}phone-country-search`;
    const numberId = `${idPrefix}phone-national-number`;
    const highlightedOption = filteredCountries[highlightedIndex];
    const highlightedOptionId = highlightedOption ? `${idPrefix}phone-country-option-${highlightedOption.code}` : undefined;

    return (
        <div className="space-y-2">
            <div className="flex items-start gap-2">
                <div ref={containerRef} className="relative flex-shrink-0 w-[9.5rem] sm:w-44">
                    <button
                        ref={triggerRef}
                        id={triggerId}
                        type="button"
                        className={theme.trigger}
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        aria-controls={open ? listboxId : undefined}
                        onClick={() => setOpen((o) => !o)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setOpen(true);
                            }
                        }}
                    >
                        <span aria-hidden="true" className="text-base leading-none">
                            {selected ? flagEmoji(selected.code) : '🌐'}
                        </span>
                        <span className="flex-1 truncate">
                            {selected ? `${selected.name} +${selected.callingCode}` : 'Select country'}
                        </span>
                        <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 flex-shrink-0 ${theme.chevron}`} fill="none">
                            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>

                    {open && (
                        <div className={`absolute left-0 top-full mt-1 z-20 w-72 max-w-[calc(100vw-2rem)] rounded-lg overflow-hidden ${theme.popover}`}>
                            <label htmlFor={searchId} className="sr-only">
                                Search country by name or calling code
                            </label>
                            <input
                                ref={searchInputRef}
                                id={searchId}
                                type="text"
                                role="combobox"
                                aria-expanded="true"
                                aria-controls={listboxId}
                                aria-autocomplete="list"
                                aria-activedescendant={highlightedOptionId}
                                placeholder="Search country or code..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                className={theme.search}
                                autoComplete="off"
                            />
                            <ul
                                ref={listRef}
                                id={listboxId}
                                role="listbox"
                                aria-label="Countries"
                                className="max-h-60 overflow-y-auto py-1"
                            >
                                {filteredCountries.map((c, index) => {
                                    const isHighlighted = index === highlightedIndex;
                                    const isSelected = c.code === country;
                                    return (
                                        <li
                                            key={c.code}
                                            id={`${idPrefix}phone-country-option-${c.code}`}
                                            data-index={index}
                                            role="option"
                                            aria-selected={isSelected}
                                            className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${isHighlighted ? theme.optionHighlighted : theme.option} ${isSelected ? 'font-semibold' : ''}`}
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => selectCountry(c)}
                                        >
                                            <span aria-hidden="true" className="text-base leading-none">{flagEmoji(c.code)}</span>
                                            <span className="flex-1 truncate">{c.name}</span>
                                            <span className="opacity-70">+{c.callingCode}</span>
                                        </li>
                                    );
                                })}
                                {filteredCountries.length === 0 && (
                                    <li role="presentation" className={`px-3 py-4 text-sm text-center ${theme.empty}`}>
                                        No countries found{search ? ` for "${search}"` : ''}.
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="flex-1">
                    <label htmlFor={numberId} className="sr-only">
                        Phone number
                    </label>
                    <input
                        id={numberId}
                        type="tel"
                        placeholder="Phone number"
                        value={nationalNumber}
                        onChange={(e) => {
                            setNationalNumber(e.target.value);
                            emit(country, e.target.value);
                        }}
                        className={theme.input}
                    />
                </div>
            </div>
            {value && !toE164(country, nationalNumber) && nationalNumber && (
                <p className={theme.hint}>This doesn't look like a valid number for the selected country yet.</p>
            )}
        </div>
    );
}
