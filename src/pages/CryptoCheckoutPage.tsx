/**
 * CryptoCheckoutPage — /checkout/crypto
 *
 * First-party, step-by-step, same-tab cryptocurrency checkout flow.
 *
 * Features:
 * 1. Step 1: Server-Authoritative Order Review (requires customer authentication).
 * 2. Step 2: Cryptocurrency Selection (shows curated, available assets grouped by Popular & Stablecoins).
 * 3. Step 3: Order Confirmation & Safe Redirect to NOWPayments hosted invoice.
 *
 * Security:
 * - No popup, dialog, iframe, or modal is used.
 * - Enforces customer session before checkout creation.
 * - Server is the sole authority for plan validity, pricing, and allowed currency selection.
 * - Validates invoice URL destination against trusted NOWPayments origins before redirect.
 */import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Section } from '@/components/common/Section';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { usePricing } from '@/hooks/useContent';
import { usePaymentCurrencies } from '@/hooks/usePayment';
import { isCryptoCheckoutSupported } from '@/lib/payment-plans';
import {
    createCheckout,
    isValidNowPaymentsInvoiceUrl,
    isApiError,
    type PaymentCurrencyData,
} from '@/lib/api-client';

export function CryptoCheckoutPage() {
    const [searchParams] = useSearchParams();
    const planKey = (searchParams.get('plan') || '').trim().toLowerCase();

    const { isAuthenticated, isLoading: authLoading } = useCustomerAuth();
    const { data: pricingData, isLoading: pricingLoading } = usePricing();
    const {
        data: currencies,
        isLoading: currenciesLoading,
        isError: currenciesError,
        refetch: refetchCurrencies,
    } = usePaymentCurrencies();

    const [selectedCurrency, setSelectedCurrency] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Resolve authoritative plan metadata from server pricing catalog
    const resolvedPlan = useMemo(() => {
        if (!pricingData?.plans || !planKey) return null;
        return pricingData.plans.find((p) => p.id.toLowerCase() === planKey) || null;
    }, [pricingData, planKey]);

    const isSupportedPlan = isCryptoCheckoutSupported(planKey);

    // Group approved currencies into Popular Coins and Stablecoins
    const { popularCurrencies, stablecoins } = useMemo(() => {
        const popular: PaymentCurrencyData[] = [];
        const stable: PaymentCurrencyData[] = [];

        if (currencies && Array.isArray(currencies)) {
            for (const item of currencies) {
                if (item.category === 'popular') {
                    popular.push(item);
                } else {
                    stable.push(item);
                }
            }
        }

        return { popularCurrencies: popular, stablecoins: stable };
    }, [currencies]);

    // Handle payment submission
    const handleProceedToPayment = async () => {
        if (!selectedCurrency || isSubmitting || !resolvedPlan || !isSupportedPlan) return;

        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            const response = await createCheckout({
                planKey: resolvedPlan.id,
                payCurrency: selectedCurrency,
                billingMode: 'one_time',
            });

            if (!isValidNowPaymentsInvoiceUrl(response.invoiceUrl)) {
                throw new Error('Received an invalid or untrusted payment redirect URL from the server.');
            }

            // Same-tab navigation to the trusted NOWPayments hosted invoice
            window.location.assign(response.invoiceUrl);
        } catch (err) {
            setIsSubmitting(false);
            if (isApiError(err)) {
                setErrorMessage(err.message);
            } else if (err instanceof Error) {
                setErrorMessage(err.message);
            } else {
                setErrorMessage('Unable to initiate checkout. Please try again.');
            }
        }
    };

    const currentReturnTo = encodeURIComponent(
        window.location.pathname + (window.location.search || ''),
    );

    const canSubmit = Boolean(selectedCurrency) && !isSubmitting && !currenciesLoading && Boolean(resolvedPlan);

    return (
        <Section padding="lg" className="bg-slate-50/50 min-h-[calc(100vh-80px)]">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header / Breadcrumbs */}
                <div className="space-y-2">
                    <Link
                        to="/pricing"
                        className="inline-flex items-center text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                    >
                        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Pricing
                    </Link>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                        Cryptocurrency Checkout
                    </h1>
                    <p className="text-slate-600 text-sm">
                        Complete your order securely using your choice of cryptocurrency.
                    </p>
                </div>

                {/* Plan Validity Guard */}
                {!pricingLoading && (!resolvedPlan || !isSupportedPlan) && (
                    <Card className="bg-white border-slate-200 p-8 text-center space-y-4 shadow-sm">
                        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center text-2xl">
                            ⚠️
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">Invalid or Unsupported Plan</h2>
                        <p className="text-slate-600 text-sm max-w-md mx-auto">
                            The selected plan is not eligible for cryptocurrency checkout or could not be found. Please select a valid plan from our pricing page.
                        </p>
                        <Link to="/pricing">
                            <Button variant="primary" className="mt-2">
                                Return to Pricing
                            </Button>
                        </Link>
                    </Card>
                )}

                {/* Main Checkout Flow */}
                {((pricingLoading || (resolvedPlan && isSupportedPlan))) && (
                    <div className="space-y-6">
                        {/* Step 1: Order Review */}
                        <Card className="bg-white border border-slate-200/90 p-6 sm:p-7 rounded-2xl shadow-sm space-y-5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center space-x-3">
                                    <span className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 border border-brand-200 flex items-center justify-center font-bold text-xs">
                                        1
                                    </span>
                                    <h2 className="text-lg font-bold text-slate-900">Order Review</h2>
                                </div>
                                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                                    One-time payment
                                </span>
                            </div>

                            {pricingLoading ? (
                                <div className="animate-pulse space-y-3 py-2">
                                    <div className="h-6 bg-slate-200 rounded w-1/3" />
                                    <div className="h-4 bg-slate-100 rounded w-2/3" />
                                </div>
                            ) : (
                                resolvedPlan && (
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-50 border border-slate-200/80">
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-900">
                                                    {resolvedPlan.name}
                                                </h3>
                                                <p className="text-sm text-slate-600 mt-0.5">
                                                    {resolvedPlan.description}
                                                </p>
                                            </div>
                                            <div className="sm:text-right flex-shrink-0">
                                                <span className="text-3xl font-extrabold text-slate-900">
                                                    ${resolvedPlan.setupFee ?? resolvedPlan.monthlyPrice}
                                                </span>
                                                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">USD Total</span>
                                            </div>
                                        </div>

                                        <div className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                                            <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>Price is verified and server-authoritative from DreamWebApp catalog.</span>
                                        </div>
                                    </div>
                                )
                            )}
                        </Card>

                        {/* Customer Authentication Check */}
                        {!authLoading && !isAuthenticated && (
                            <Card className="bg-amber-50/60 border border-amber-200/90 p-6 sm:p-7 rounded-2xl shadow-sm space-y-4">
                                <div className="flex items-start space-x-3.5">
                                    <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 flex-shrink-0">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-base font-bold text-slate-900">
                                            Sign in required to complete purchase
                                        </h3>
                                        <p className="text-xs text-slate-700 leading-relaxed">
                                            Please sign in to link your cryptocurrency payment and automatically activate your service entitlement in your customer dashboard.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <Link to={`/login?returnTo=${currentReturnTo}`} className="flex-1">
                                        <Button variant="primary" fullWidth size="md">
                                            Sign In to Continue
                                        </Button>
                                    </Link>
                                    <Link to={`/register?returnTo=${currentReturnTo}`} className="flex-1">
                                        <Button variant="secondary" fullWidth size="md">
                                            Create Account
                                        </Button>
                                    </Link>
                                </div>
                            </Card>
                        )}

                        {/* Step 2: Select Cryptocurrency (Enabled only when authenticated) */}
                        {isAuthenticated && (
                            <Card className="bg-white border border-slate-200/90 p-6 sm:p-7 rounded-2xl shadow-sm space-y-6">
                                <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
                                    <span className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 border border-brand-200 flex items-center justify-center font-bold text-xs">
                                        2
                                    </span>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">Select Cryptocurrency</h2>
                                        <p className="text-xs text-slate-600">
                                            Choose an approved asset to generate your secure payment invoice.
                                        </p>
                                    </div>
                                </div>

                                {/* Loading state */}
                                {currenciesLoading && (
                                    <div className="py-12 text-center space-y-3" aria-live="polite">
                                        <svg className="animate-spin w-8 h-8 text-brand-600 mx-auto" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                        </svg>
                                        <p className="text-sm font-medium text-slate-600">Loading approved payment assets…</p>
                                    </div>
                                )}

                                {/* Error state */}
                                {currenciesError && (
                                    <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-start justify-between gap-4">
                                        <div>
                                            <p className="font-semibold text-red-900">Unable to load cryptocurrencies</p>
                                            <p className="text-xs text-red-700 mt-0.5">Please check your connection and try again.</p>
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={() => refetchCurrencies()}>
                                            Retry
                                        </Button>
                                    </div>
                                )}

                                {/* Currencies List */}
                                {!currenciesLoading && !currenciesError && currencies && currencies.length > 0 && (
                                    <fieldset className="space-y-6" aria-label="Available Cryptocurrencies">
                                        {/* Popular Coins Group */}
                                        {popularCurrencies.length > 0 && (
                                            <div className="space-y-2.5">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                                    <span aria-hidden="true">🔥</span> Popular Coins
                                                </h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {popularCurrencies.map((c) => {
                                                        const isSelected = selectedCurrency === c.code;
                                                        return (
                                                            <button
                                                                key={c.code}
                                                                type="button"
                                                                id={`crypto-opt-${c.code}`}
                                                                onClick={() => {
                                                                    setSelectedCurrency(c.code);
                                                                    setErrorMessage(null);
                                                                }}
                                                                aria-pressed={isSelected}
                                                                className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                                                                    isSelected
                                                                        ? 'bg-brand-50/80 border-2 border-brand-600 ring-2 ring-brand-500/20 shadow-sm'
                                                                        : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-brand-300 hover:shadow-sm'
                                                                }`}
                                                            >
                                                                <div className="space-y-0.5 min-w-0 pr-2">
                                                                    <div className="flex items-center space-x-1.5">
                                                                        <span className={`font-bold text-sm ${isSelected ? 'text-brand-950' : 'text-slate-900'}`}>
                                                                            {c.symbol}
                                                                        </span>
                                                                        {c.network && (
                                                                            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                                                                {c.network}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className={`text-xs truncate ${isSelected ? 'text-brand-700 font-medium' : 'text-slate-500'}`}>
                                                                        {c.name}
                                                                    </p>
                                                                </div>
                                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                                    isSelected ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'
                                                                }`}>
                                                                    {isSelected && (
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Stablecoins Group */}
                                        {stablecoins.length > 0 && (
                                            <div className="space-y-2.5">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                                    <span aria-hidden="true">💵</span> Stablecoins
                                                </h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {stablecoins.map((c) => {
                                                        const isSelected = selectedCurrency === c.code;
                                                        return (
                                                            <button
                                                                key={c.code}
                                                                type="button"
                                                                id={`crypto-opt-${c.code}`}
                                                                onClick={() => {
                                                                    setSelectedCurrency(c.code);
                                                                    setErrorMessage(null);
                                                                }}
                                                                aria-pressed={isSelected}
                                                                className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                                                                    isSelected
                                                                        ? 'bg-brand-50/80 border-2 border-brand-600 ring-2 ring-brand-500/20 shadow-sm'
                                                                        : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-brand-300 hover:shadow-sm'
                                                                }`}
                                                            >
                                                                <div className="space-y-0.5 min-w-0 pr-2">
                                                                    <div className="flex items-center space-x-1.5">
                                                                        <span className={`font-bold text-sm ${isSelected ? 'text-brand-950' : 'text-slate-900'}`}>
                                                                            {c.symbol}
                                                                        </span>
                                                                        {c.network && (
                                                                            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                                                                {c.network}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className={`text-xs truncate ${isSelected ? 'text-brand-700 font-medium' : 'text-slate-500'}`}>
                                                                        {c.name}
                                                                    </p>
                                                                </div>
                                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                                    isSelected ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'
                                                                }`}>
                                                                    {isSelected && (
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </fieldset>
                                )}

                                {/* Zero Currencies Available State */}
                                {!currenciesLoading && !currenciesError && currencies?.length === 0 && (
                                    <div className="p-6 text-center rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                        <p className="text-sm font-semibold text-slate-800">
                                            No payment currencies are currently available.
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Please try again in a few moments or contact customer support.
                                        </p>
                                        <Button size="sm" variant="secondary" onClick={() => refetchCurrencies()} className="mt-2">
                                            Refresh Currencies
                                        </Button>
                                    </div>
                                )}

                                {/* Step 3: Confirmation and Action */}
                                <div className="pt-4 border-t border-slate-100 space-y-4">
                                    {/* Security Notice */}
                                    <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-100 text-xs text-sky-950 flex items-start space-x-3">
                                        <span className="text-base flex-shrink-0" aria-hidden="true">🔒</span>
                                        <div className="space-y-1">
                                            <p className="font-bold text-sky-950">
                                                Secure Provider Checkout Sequence
                                            </p>
                                            <p className="text-sky-800 leading-relaxed">
                                                Clicking <strong className="font-bold text-sky-950">Continue to secure payment</strong> creates an authoritative order and sends you to NOWPayments hosted checkout, where the exact crypto payment address, QR code, and amount will be displayed.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Error announcement */}
                                    {errorMessage && (
                                        <div
                                            role="alert"
                                            aria-live="assertive"
                                            className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800"
                                        >
                                            {errorMessage}
                                        </div>
                                    )}

                                    {/* Submit Action */}
                                    <Button
                                        variant={selectedCurrency ? 'accent' : 'primary'}
                                        fullWidth
                                        size="lg"
                                        id="checkout-confirm-btn"
                                        onClick={handleProceedToPayment}
                                        disabled={!canSubmit}
                                        aria-busy={isSubmitting}
                                        className="text-base font-bold shadow-lg"
                                    >
                                        {isSubmitting ? (
                                            <span className="flex items-center justify-center space-x-2">
                                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                                </svg>
                                                Redirecting to secure payment…
                                            </span>
                                        ) : selectedCurrency ? (
                                            `Continue to secure payment with ${selectedCurrency.toUpperCase()}`
                                        ) : (
                                            'Select a cryptocurrency above'
                                        )}
                                    </Button>
                                </div>
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </Section>
    );
}
