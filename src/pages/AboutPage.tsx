import { Section, SectionHeader } from '@/components/common/Section';
import { Card } from '@/components/common/Card';
import { useSite } from '@/hooks/useContent';

/**
 * About Page
 * Company information, mission, and technology powered by useSite
 */
export function AboutPage() {
    const { data: site } = useSite();

    const brandName = site?.brand?.name || 'DreamWebApp';
    const brandTagline = site?.brand?.tagline || 'AI-Powered Chatbots & Automations for Small Business';

    return (
        <>
            {/* Page Header */}
            <Section background="gradient" padding="md">
                <div className="text-center max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                        About <span className="gradient-text">{brandName}</span>
                    </h1>
                    <p className="text-xl text-slate-600">
                        {brandTagline}
                    </p>
                </div>
            </Section>

            {/* Mission */}
            <Section>
                <div className="max-w-4xl mx-auto">
                    <SectionHeader
                        title="Our Mission"
                        subtitle="Making enterprise AI accessible to small businesses"
                    />

                    <div className="prose prose-lg max-w-none">
                        <p className="text-lg text-slate-700 leading-relaxed mb-6">
                            We believe every small business deserves access to the same powerful AI technology that large corporations use. Too many entrepreneurs are stuck answering the same questions, missing leads, and unable to scale because they can't afford a full support team.
                        </p>
                        <p className="text-lg text-slate-700 leading-relaxed mb-6">
                            That's why we built {brandName}—to give small businesses the tools to automate customer support, capture leads 24/7, and compete with bigger players, all without breaking the bank.
                        </p>
                        <p className="text-lg text-slate-700 leading-relaxed">
                            Our team combines expertise in AI, automation, and small business operations to deliver solutions that actually work for real businesses, not just tech companies.
                        </p>
                    </div>
                </div>
            </Section>

            {/* Values */}
            <Section background="gray">
                <SectionHeader title="Our Values" />

                <div className="grid md:grid-cols-3 gap-8">
                    <Card hover>
                        <div className="text-4xl mb-4">🎯</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Results-Focused</h3>
                        <p className="text-slate-600">
                            We measure our success by your results—more leads captured, time saved, and revenue generated.
                        </p>
                    </Card>

                    <Card hover>
                        <div className="text-4xl mb-4">🤝</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Partnership</h3>
                        <p className="text-slate-600">
                            You're not just a client—you're a partner. We succeed when you succeed, and we're with you long-term.
                        </p>
                    </Card>

                    <Card hover>
                        <div className="text-4xl mb-4">🔧</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Simplicity</h3>
                        <p className="text-slate-600">
                            AI should be simple, not complicated. We handle the tech so you can focus on your business.
                        </p>
                    </Card>
                </div>
            </Section>

            {/* Technology Stack */}
            <Section>
                <div className="max-w-4xl mx-auto">
                    <SectionHeader
                        title="Built on Modern Technology"
                        subtitle="Fast, secure, and reliable infrastructure"
                    />

                    <div className="bg-gradient-to-br from-slate-50 to-brand-50 rounded-2xl p-8 md:p-12 border border-slate-200">
                        <div className="grid md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-4">Infrastructure</h3>
                                <ul className="space-y-3">
                                    <li className="flex items-start">
                                        <span className="text-brand-600 mr-2">•</span>
                                        <span className="text-slate-700">
                                            <strong>Cloudflare Edge:</strong> Global CDN and Workers for instant page loads worldwide
                                        </span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="text-brand-600 mr-2">•</span>
                                        <span className="text-slate-700">
                                            <strong>Modern AI Models:</strong> Latest language models trained on your business
                                        </span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="text-brand-600 mr-2">•</span>
                                        <span className="text-slate-700">
                                            <strong>Secure Hosting:</strong> Enterprise-grade security and encryption
                                        </span>
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-4">Compliance & Security</h3>
                                <ul className="space-y-3">
                                    <li className="flex items-start">
                                        <span className="text-brand-600 mr-2">•</span>
                                        <span className="text-slate-700">
                                            <strong>GDPR & CCPA Compliant:</strong> Full data privacy compliance
                                        </span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="text-brand-600 mr-2">•</span>
                                        <span className="text-slate-700">
                                            <strong>Encrypted Data:</strong> All data encrypted in transit and at rest
                                        </span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="text-brand-600 mr-2">•</span>
                                        <span className="text-slate-700">
                                            <strong>99.9% Uptime:</strong> Reliable infrastructure with redundancy
                                        </span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </Section>

            {/* CTA */}
            <Section background="gradient">
                <div className="text-center max-w-3xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                        Let's Build Something Amazing Together
                    </h2>
                    <p className="text-xl text-slate-600 mb-8">
                        Ready to transform your customer experience with AI?
                    </p>
                    <a
                        href="/contact"
                        className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg bg-gradient-to-r from-accent-600 to-accent-700 text-white hover:from-accent-700 hover:to-accent-800 shadow-lg shadow-accent-500/30 hover:shadow-xl hover:scale-105 transition-all duration-200"
                    >
                        Get in Touch
                    </a>
                </div>
            </Section>
        </>
    );
}
