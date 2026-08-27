import { Section, SectionHeader } from '@/components/common/Section';
import { PricingCard } from '@/components/pricing/PricingCard';
import { Card } from '@/components/common/Card';
import { usePricing } from '@/hooks/useContent';

/**
 * Pricing Page
 * Displays pricing plans and add-ons.
 * Data is fetched from the Worker API with static fallback via placeholderData.
 */
export function PricingPage() {
    const { data: pricing } = usePricing();
    const pricingPlans = pricing?.plans ?? [];
    const addOns = pricing?.addons ?? [];
    return (
        <>
            {/* Page Header */}
            <Section background="gradient" padding="md">
                <div className="text-center max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                        Simple, <span className="gradient-text">Transparent Pricing</span>
                    </h1>
                    <p className="text-xl text-slate-600">
                        Choose the plan that fits your business. No hidden fees, cancel anytime.
                    </p>
                </div>
            </Section>

            {/* Pricing Plans */}
            <Section>
                <div className="grid md:grid-cols-3 gap-8 mb-16">
                    {pricingPlans.map((plan) => (
                        <div key={plan.id} className={plan.highlighted ? 'md:-mt-4' : ''}>
                            <PricingCard plan={plan} />
                        </div>
                    ))}
                </div>

                {/* Value Props */}
                <div className="bg-brand-50 rounded-2xl p-8 border border-brand-200">
                    <h3 className="text-xl font-bold text-center text-slate-900 mb-6">
                        All Plans Include
                    </h3>
                    <div className="grid md:grid-cols-4 gap-6 text-center">
                        <div>
                            <div className="text-2xl mb-2">✓</div>
                            <p className="text-sm font-medium text-slate-700">Custom AI Training</p>
                        </div>
                        <div>
                            <div className="text-2xl mb-2">✓</div>
                            <p className="text-sm font-medium text-slate-700">Website Integration</p>
                        </div>
                        <div>
                            <div className="text-2xl mb-2">✓</div>
                            <p className="text-sm font-medium text-slate-700">Mobile Responsive</p>
                        </div>
                        <div>
                            <div className="text-2xl mb-2">✓</div>
                            <p className="text-sm font-medium text-slate-700">30-Day Guarantee</p>
                        </div>
                    </div>
                </div>
            </Section>

            {/* Add-ons */}
            <Section background="gray">
                <SectionHeader
                    title="Powerful Add-Ons"
                    subtitle="Enhance your chatbot with additional features"
                />

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {addOns.map((addon) => (
                        <Card key={addon.id} hover>
                            <h3 className="font-bold text-slate-900 mb-2">{addon.name}</h3>
                            <p className="text-sm text-slate-600 mb-4">{addon.description}</p>
                            <div className="pt-4 border-t border-slate-200">
                                <div className="text-2xl font-bold gradient-text">
                                    ${addon.price.toLocaleString()}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {addon.priceType === 'one-time' ? 'One-time setup' : 'Per month'}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </Section>

            {/* FAQ */}
            <Section>
                <div className="max-w-3xl mx-auto">
                    <SectionHeader title="Pricing FAQs" />

                    <div className="space-y-6">
                        <Card>
                            <h3 className="font-semibold text-slate-900 mb-2">
                                What's the difference between setup and monthly fees?
                            </h3>
                            <p className="text-slate-600 text-sm">
                                The setup fee covers initial chatbot creation, training, and integration. Monthly fees (where applicable) cover hosting, monitoring, updates, and support. You can choose Starter Bot for one-time setup only, or Growth Bot for ongoing management.
                            </p>
                        </Card>

                        <Card>
                            <h3 className="font-semibold text-slate-900 mb-2">
                                Can I upgrade or downgrade later?
                            </h3>
                            <p className="text-slate-600 text-sm">
                                Absolutely! You can upgrade anytime. Downgrading is available at the end of your billing period. We'll prorate your first month when upgrading.
                            </p>
                        </Card>

                        <Card>
                            <h3 className="font-semibold text-slate-900 mb-2">
                                Do you offer refunds?
                            </h3>
                            <p className="text-slate-600 text-sm">
                                Yes! We offer a 30-day satisfaction guarantee. If you're not happy within 30 days of launch, we'll refund your setup fee (minus any custom integration work).
                            </p>
                        </Card>
                    </div>
                </div>
            </Section>

            {/* CTA */}
            <Section background="gradient">
                <div className="text-center max-w-3xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                        Ready to Get Started?
                    </h2>
                    <p className="text-xl text-slate-600 mb-8">
                        Book a free demo and we'll help you choose the perfect plan
                    </p>
                    <a
                        href="/contact"
                        className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg bg-gradient-to-r from-accent-600 to-accent-700 text-white hover:from-accent-700 hover:to-accent-800 shadow-lg shadow-accent-500/30 hover:shadow-xl hover:scale-105 transition-all duration-200"
                    >
                        Book Your Free Demo
                    </a>
                </div>
            </Section>
        </>
    );
}
