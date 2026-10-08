import { Link } from 'react-router-dom';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { isCryptoCheckoutSupported } from '@/lib/payment-plans';
import { selectCmsCheckoutFee } from '@shared/cms-checkout-amount';
import { CATALOG_DISPLAY_CURRENCY, formatMoneyAmount } from '@shared/monetary-display';
import { buildCryptoCheckoutPath } from '@shared/checkout-route';
import type { PricingPlanData } from '@/lib/api-client';

export interface PricingCardProps {
    plan: PricingPlanData;
}

function dueAtCheckoutLabel(plan: PricingPlanData): string | null {
    if (plan.checkoutAmountDecimal && Number(plan.checkoutAmountDecimal) > 0) {
        return formatMoneyAmount(plan.checkoutAmountDecimal, CATALOG_DISPLAY_CURRENCY);
    }
    const selected = selectCmsCheckoutFee(plan);
    if (selected == null || !Number.isFinite(Number(selected)) || Number(selected) <= 0) {
        return null;
    }
    return formatMoneyAmount(Number(selected).toFixed(2), CATALOG_DISPLAY_CURRENCY);
}

function ongoingAccessDecimal(monthlyPrice: number): string | null {
    if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0) return null;
    return monthlyPrice.toFixed(2);
}

/**
 * Pricing Card component
 * Displays pricing plan with features and CTA.
 * Checkout amount uses the same CMS fee selection as the server quote.
 * Ongoing access (monthly) is disclosed separately and is not implied as automatic billing.
 */
export function PricingCard({ plan }: PricingCardProps) {
    const isCryptoSupported = isCryptoCheckoutSupported(plan.id);
    const canCheckout = Boolean(isCryptoSupported && (plan.checkoutEligible ?? true));
    const dueLabel = dueAtCheckoutLabel(plan);
    const ongoing = ongoingAccessDecimal(plan.monthlyPrice);
    const setupWins = Number(plan.setupFee ?? 0) > 0;

    return (
        <Card
            hover
            className={`h-full flex flex-col relative ${
                plan.highlighted ? 'ring-2 ring-brand-500 shadow-2xl scale-105' : ''
            }`}
        >
            {plan.badge && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="badge badge-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wide shadow-lg">
                        {plan.badge}
                    </span>
                </div>
            )}

            <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-slate-600">{plan.description}</p>
            </div>

            <div className="mb-6">
                {dueLabel ? (
                    <>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold gradient-text">{dueLabel}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-2">Due at checkout (one-time)</p>
                        {setupWins && ongoing && (
                            <p className="text-sm text-slate-600 mt-1">
                                Ongoing access {formatMoneyAmount(ongoing, CATALOG_DISPLAY_CURRENCY)}/month,
                                arranged separately — not charged automatically.
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-slate-600">Checkout amount not available for this plan.</p>
                )}
            </div>

            <div className="mb-6 p-4 bg-brand-50 rounded-lg border border-brand-100">
                <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide mb-1">
                    Best For
                </p>
                <p className="text-sm text-slate-700">{plan.bestFor}</p>
            </div>

            <div className="mb-8 flex-1">
                <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
                    Everything Included
                </h4>
                <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start text-sm text-slate-700">
                            <svg
                                className="w-5 h-5 text-brand-500 mr-3 flex-shrink-0 mt-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="space-y-3">
                <Button
                    variant={plan.highlighted ? 'accent' : 'primary'}
                    fullWidth
                    size="lg"
                >
                    {plan.ctaText}
                </Button>

                {canCheckout && dueLabel && (
                    <Link
                        to={buildCryptoCheckoutPath(plan.id)}
                        className="block w-full"
                    >
                        <Button
                            variant="outline"
                            fullWidth
                            size="md"
                            id={`crypto-pay-${plan.id}`}
                            aria-label={`Pay for ${plan.name} with cryptocurrency (One-time payment)`}
                        >
                            <span className="mr-2" aria-hidden="true">₿</span>
                            Pay with crypto (One-time)
                        </Button>
                    </Link>
                )}
            </div>
        </Card>
    );
}
