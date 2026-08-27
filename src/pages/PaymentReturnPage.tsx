/**
 * PaymentReturnPage — /payment/return
 *
 * Displays the canonical payment status after a customer returns from
 * the NOWPayments hosted invoice page.
 *
 * Security:
 * - The page NEVER grants access based on the URL query string alone.
 * - It polls the backend for the server-verified status only.
 * - Only a webhook-confirmed `paid` status grants entitlement.
 */

import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Section } from '@/components/common/Section';
import { Card } from '@/components/common/Card';
import { PaymentStatusBadge } from '@/components/payment/PaymentStatusBadge';
import { useOrderStatus } from '@/hooks/usePayment';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

export function PaymentReturnPage() {
    const [searchParams] = useSearchParams();
    const { isAuthenticated } = useCustomerAuth();

    // Prefer URL params from provider redirect (success_url / cancel_url)
    const [orderId] = useState<string | null>(() => searchParams.get('order_id'));
    const [statusToken] = useState<string | null>(() => searchParams.get('token'));

    const isCancelled = searchParams.get('cancelled') === '1';

    const { data: order, isLoading, isError, error } = useOrderStatus(orderId, statusToken);

    return (
        <Section padding="lg">
            <div className="max-w-lg mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Payment Status</h1>
                    <p className="text-slate-600">
                        {isCancelled
                            ? 'You cancelled the payment. No charge was made.'
                            : 'Your payment is being processed.'}
                    </p>
                </div>

                <Card>
                    {/* No order credentials */}
                    {!orderId && (
                        <div className="text-center py-8">
                            <p className="text-slate-500 mb-4">
                                No order reference found. If you just completed a payment, please check your email.
                            </p>
                            <Link
                                to="/pricing"
                                className="text-brand-600 font-semibold hover:underline"
                            >
                                ← Back to Pricing
                            </Link>
                        </div>
                    )}

                    {/* Loading */}
                    {orderId && isLoading && (
                        <div className="flex flex-col items-center py-8 gap-4" aria-live="polite" aria-label="Loading payment status">
                            <svg className="animate-spin w-10 h-10 text-brand-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            <p className="text-slate-600 font-medium">Loading payment status…</p>
                        </div>
                    )}

                    {/* Error */}
                    {orderId && isError && (
                        <div role="alert" className="text-center py-8">
                            <p className="text-red-600 font-medium mb-2">Could not load payment status.</p>
                            <p className="text-slate-500 text-sm mb-4">
                                {error instanceof Error ? error.message : 'Please try refreshing the page.'}
                            </p>
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="text-brand-600 font-semibold hover:underline"
                            >
                                Refresh
                            </button>
                        </div>
                    )}

                    {/* Order status display */}
                    {order && (
                        <div className="space-y-6" aria-live="polite">
                            {/* Status badge */}
                            <div className="flex flex-col items-center gap-3 py-4">
                                <PaymentStatusBadge
                                    status={order.status}
                                    label={order.statusLabel}
                                    className="text-base px-6 py-2"
                                />

                                {/* Spinner while non-terminal */}
                                {!order.isTerminal && (
                                    <p className="text-sm text-slate-500 flex items-center gap-2">
                                        <svg className="animate-spin w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                        </svg>
                                        Checking for updates…
                                    </p>
                                )}
                            </div>

                            {/* Order details */}
                            <dl className="divide-y divide-slate-200 text-sm">
                                <div className="flex justify-between py-3">
                                    <dt className="text-slate-500 font-medium">Order ID</dt>
                                    <dd className="text-slate-900 font-mono text-xs max-w-[180px] truncate" title={order.orderId}>
                                        {order.orderId}
                                    </dd>
                                </div>
                                <div className="flex justify-between py-3">
                                    <dt className="text-slate-500 font-medium">Plan</dt>
                                    <dd className="text-slate-900 capitalize">{order.planKey.replace(/-/g, ' ')}</dd>
                                </div>
                                <div className="flex justify-between py-3">
                                    <dt className="text-slate-500 font-medium">Amount</dt>
                                    <dd className="text-slate-900 font-semibold">
                                        {order.priceAmount} {order.priceCurrency}
                                    </dd>
                                </div>
                                <div className="flex justify-between py-3">
                                    <dt className="text-slate-500 font-medium">Paying with</dt>
                                    <dd className="text-slate-900 font-semibold">{order.payCurrency}</dd>
                                </div>
                                {order.payAmount && (
                                    <div className="flex justify-between py-3">
                                        <dt className="text-slate-500 font-medium">Crypto amount</dt>
                                        <dd className="text-slate-900 font-semibold font-mono text-xs">
                                            {order.payAmount} {order.payCurrency}
                                        </dd>
                                    </div>
                                )}
                            </dl>

                            {/* Success message */}
                            {order.isPaid && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-3">
                                    <div>
                                        <p className="text-green-800 font-semibold mb-1">🎉 Payment confirmed!</p>
                                        <p className="text-green-700 text-sm">
                                            Your payment is verified and your service is being provisioned.
                                        </p>
                                    </div>
                                    {isAuthenticated ? (
                                        <div className="pt-1">
                                            <Link
                                                to="/account?tab=services"
                                                className="inline-flex items-center justify-center px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
                                            >
                                                View in Customer Dashboard &rarr;
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="pt-1">
                                            <Link
                                                to="/login?returnTo=/account"
                                                className="inline-flex items-center justify-center px-5 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                                            >
                                                Sign In to View Services &rarr;
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Failure / expiry message */}
                            {(order.status === 'failed' || order.status === 'expired') && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                                    <p className="text-red-800 font-semibold mb-2">
                                        {order.status === 'expired' ? 'This invoice has expired.' : 'The payment failed.'}
                                    </p>
                                    <Link
                                        to="/pricing"
                                        className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                                    >
                                        Try again
                                    </Link>
                                </div>
                            )}

                            {/* Partial payment warning */}
                            {order.status === 'partially_paid' && (
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                                    <p className="text-orange-800 font-semibold mb-1">⚠️ Partially paid</p>
                                    <p className="text-orange-700 text-sm">
                                        We received part of the payment. Please contact support with your order ID.
                                    </p>
                                </div>
                            )}

                            {/* Navigation */}
                            {order.isTerminal && !order.isPaid && (
                                <div className="text-center pt-2">
                                    <Link to="/pricing" className="text-brand-600 font-semibold hover:underline text-sm">
                                        ← Back to Pricing
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </Section>
    );
}
