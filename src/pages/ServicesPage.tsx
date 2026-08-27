import { Section, SectionHeader } from '@/components/common/Section';
import { ServiceCard } from '@/components/services/ServiceCard';
import { useServices } from '@/hooks/useContent';
import type { ServiceData } from '@/lib/api-client';

/**
 * The footer/site-settings "Services" links point at short category anchors
 * (`/services#chatbot`, `#care`, `#receptionist`, `#automation`) rather than
 * literal service ids, so multiple services can share a category. This maps
 * each service's id prefix to its category anchor; the first service in a
 * given category is the one that actually receives the anchor, so the link
 * still resolves to a real element on the page without needing every
 * service to be individually re-keyed.
 */
const ANCHOR_PREFIXES: Array<{ prefix: string; anchor: string }> = [
    { prefix: 'chatbot-setup', anchor: 'chatbot' },
    { prefix: 'chatbot-care', anchor: 'care' },
    { prefix: 'ai-receptionist', anchor: 'receptionist' },
    { prefix: 'automation', anchor: 'automation' },
];

function assignAnchors(services: ServiceData[]): Map<string, string> {
    const anchorsById = new Map<string, string>();
    const usedAnchors = new Set<string>();
    for (const service of services) {
        const match = ANCHOR_PREFIXES.find((entry) => service.id.startsWith(entry.prefix));
        if (match && !usedAnchors.has(match.anchor)) {
            anchorsById.set(service.id, match.anchor);
            usedAnchors.add(match.anchor);
        }
    }
    return anchorsById;
}

/**
 * Services Page
 * Showcases all service offerings.
 * Data is fetched from the Worker API with static fallback via placeholderData.
 */
export function ServicesPage() {
    const { data: services = [] } = useServices();
    const anchorsById = assignAnchors(services);
    return (
        <>
            {/* Page Header */}
            <Section background="gradient" padding="md">
                <div className="text-center max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                        Our <span className="gradient-text">Services</span>
                    </h1>
                    <p className="text-xl text-slate-600">
                        Comprehensive AI chatbot and automation solutions designed for small businesses
                    </p>
                </div>
            </Section>

            {/* All Services */}
            <Section>
                <SectionHeader
                    title="What We Offer"
                    subtitle="From setup to ongoing optimization, we handle everything"
                />

                <div className="grid md:grid-cols-2 gap-8 mb-16">
                    {services.map((service) => (
                        <ServiceCard key={service.id} service={service} anchorId={anchorsById.get(service.id)} />
                    ))}
                </div>

                {/* Value Proposition */}
                <div className="bg-gradient-to-br from-brand-50 to-accent-50 rounded-2xl p-8 md:p-12 border border-brand-200">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6 text-center">
                        Why Choose DreamWebApp?
                    </h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="text-center">
                            <div className="text-3xl mb-3">⚡</div>
                            <h3 className="font-semibold text-slate-900 mb-2">Fast Setup</h3>
                            <p className="text-sm text-slate-600">
                                Most projects launch within 5-7 business days
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl mb-3">🎯</div>
                            <h3 className="font-semibold text-slate-900 mb-2">Custom Solutions</h3>
                            <p className="text-sm text-slate-600">
                                Tailored to your business, not generic templates
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl mb-3">💪</div>
                            <h3 className="font-semibold text-slate-900 mb-2">Ongoing Support</h3>
                            <p className="text-sm text-slate-600">
                                We're with you every step of the way
                            </p>
                        </div>
                    </div>
                </div>
            </Section>
        </>
    );
}
