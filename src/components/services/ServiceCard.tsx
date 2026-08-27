import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import type { ServiceData } from '@/lib/api-client';

export interface ServiceCardProps {
    service: ServiceData;
    /** Optional anchor id (e.g. from a footer/nav link) rendered on the card's wrapper. */
    anchorId?: string;
}

/**
 * Service Card component.
 *
 * Leads with the decision-relevant summary — outcome, audience, timeline,
 * price — and tucks the longer description and full inclusion list behind
 * an expandable "Full details" section (same collapse pattern as the FAQ
 * accordion) so the card stays scannable without deleting any canonical
 * content or clipping it at a fixed height.
 */
export function ServiceCard({ service, anchorId }: ServiceCardProps) {
    const [showDetails, setShowDetails] = useState(false);

    const formatPrice = () => {
        if (service.pricing.type === 'one-time' && service.pricing.amount) {
            return `$${service.pricing.amount.toLocaleString()}`;
        }
        if (service.pricing.type === 'monthly' && service.pricing.amount) {
            return `$${service.pricing.amount}/mo`;
        }
        return service.pricing.note || 'Custom';
    };

    const primaryAudience = service.whoItsFor[0];
    const additionalAudienceCount = Math.max(service.whoItsFor.length - 1, 0);

    return (
        <Card
            hover
            id={anchorId}
            className={`h-full flex flex-col${anchorId ? ' scroll-mt-24' : ''}`}
        >
            {/* Icon, Title, Outcome-oriented summary */}
            <div className="flex items-start gap-4 mb-4">
                <div className="text-4xl" aria-hidden="true">{service.icon}</div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-1">{service.name}</h3>
                    <p className="text-slate-600">{service.shortDescription}</p>
                </div>
            </div>

            {/* Decision-relevant summary: audience, timeline, price */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
                {primaryAudience && (
                    <span className="inline-flex items-center text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-full px-3 py-1">
                        Best for: {primaryAudience}
                        {additionalAudienceCount > 0 && ` +${additionalAudienceCount} more`}
                    </span>
                )}
                <span className="inline-flex items-center text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
                    ⏱ {service.timeline}
                </span>
            </div>

            {/* Full details — collapsed by default to keep the card scannable */}
            <button
                type="button"
                onClick={() => setShowDetails((prev) => !prev)}
                aria-expanded={showDetails}
                className="text-left text-sm font-semibold text-brand-700 hover:text-brand-800 mb-2 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded inline-flex items-center gap-1"
            >
                <svg
                    className={`w-4 h-4 transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {showDetails ? 'Hide full details' : 'Show full details'}
            </button>

            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${showDetails ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <p className="text-slate-700 mb-6 leading-relaxed">
                    {service.longDescription}
                </p>

                <div className="mb-6">
                    <h4 className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-3">
                        Who It's For
                    </h4>
                    <ul className="space-y-2">
                        {service.whoItsFor.map((item, index) => (
                            <li key={index} className="flex items-start text-sm text-slate-600">
                                <span className="text-brand-500 mr-2 mt-0.5">✓</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="mb-6">
                    <h4 className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-3">
                        What's Included
                    </h4>
                    <ul className="grid grid-cols-1 gap-2">
                        {service.included.map((item, index) => (
                            <li key={index} className="flex items-start text-sm text-slate-600">
                                <span className="text-brand-500 mr-2 mt-0.5">•</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Footer with Pricing and CTA */}
            <div className="mt-auto pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                            {service.pricing.type === 'one-time' ? 'Starting At' : 'Pricing'}
                        </p>
                        <p className="text-2xl font-bold gradient-text">{formatPrice()}</p>
                        {service.pricing.note && service.pricing.type !== 'custom' && (
                            <p className="text-xs text-slate-500">{service.pricing.note}</p>
                        )}
                    </div>
                </div>

                <Link to="/contact">
                    <Button variant="primary" fullWidth>
                        Get Started
                    </Button>
                </Link>
            </div>
        </Card>
    );
}
