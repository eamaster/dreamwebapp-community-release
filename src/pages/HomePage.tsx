import { Link } from 'react-router-dom';
import { Section, SectionHeader } from '@/components/common/Section';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ServiceCard } from '@/components/services/ServiceCard';
import { FAQList } from '@/components/home/FAQItem';
import { useServices, useSolutions, useFAQ } from '@/hooks/useContent';
import { useOptionalChatWidget } from '@/components/chat/useChatWidget';
import { chatContent } from '@/content/chat';

/**
 * Home Page
 * Main landing page with hero, features, services, and more.
 * Data is fetched from the Worker API and falls back to bundled static data
 * via placeholderData so there is no loading flash on first render.
 */
export function HomePage() {
    const { data: services = [] } = useServices();
    const { data: solutions = [] } = useSolutions();
    const { data: faqs = [] } = useFAQ();
    const chatWidget = useOptionalChatWidget();

    // Get first 3 services for homepage
    const featuredServices = services.slice(0, 3);

    // Get first 6 FAQs for homepage
    const featuredFAQs = faqs.slice(0, 6);

    return (
        <>
            {/* Hero Section */}
            <Section background="gradient" padding="lg" >
                <div className="text-center max-w-4xl mx-auto">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 animate-fade-in">
                        AI Chatbots & Automation for{' '}
                        <span className="gradient-text">Small Businesses</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-slate-600 mb-8 leading-relaxed animate-fade-in animation-delay-100">
                        Stop missing leads. Automate customer support. Scale your business without hiring a team.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in animation-delay-200">
                        {chatWidget && (
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={() => chatWidget.openWithPrefill(chatContent.starterPrompts[0]?.prompt ?? '')}
                            >
                                Try the AI Assistant
                            </Button>
                        )}
                        <Link to="/contact">
                            <Button variant="accent" size="lg">
                                Book Your Free Demo
                            </Button>
                        </Link>
                    </div>
                    <div className="mt-4 animate-fade-in animation-delay-200">
                        <Link to="/pricing" className="text-sm font-semibold text-brand-700 hover:text-brand-800 underline">
                            or view pricing →
                        </Link>
                    </div>

                    {/* Social Proof */}
                    <div className="mt-12 pt-8 border-t border-slate-200">
                        <p className="text-sm text-slate-500 mb-4">Trusted by small businesses worldwide</p>
                        <div className="flex items-center justify-center gap-8 text-slate-400">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-brand-600">24/7</div>
                                <div className="text-xs">Support</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-brand-600">5-7</div>
                                <div className="text-xs">Days Setup</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-brand-600">30+</div>
                                <div className="text-xs">Happy Clients</div>
                            </div>
                        </div>
                    </div>
                </div>
            </Section>

            {/* See what it can help with */}
            {chatWidget && (
                <Section background="white" padding="sm">
                    <SectionHeader
                        title="See what our AI Assistant can help with"
                        subtitle="Click a question to get an instant answer, right here on the site"
                    />
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {chatContent.starterPrompts.map((sp) => (
                            <button
                                key={sp.id}
                                type="button"
                                onClick={() =>
                                    sp.intent === 'handoff'
                                        ? chatWidget.openHandoff()
                                        : chatWidget.openAndSend(sp.prompt)
                                }
                                className="text-left h-full bg-white rounded-xl border border-slate-200 shadow-md p-6 hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                            >
                                <div className="text-3xl mb-3">{sp.icon}</div>
                                <h3 className="font-bold text-slate-900 mb-1">{sp.outcomeTitle}</h3>
                                <p className="text-sm text-slate-600">{sp.outcomeDescription}</p>
                            </button>
                        ))}
                    </div>
                </Section>
            )}

            {/* Problems & Benefits */}
            <Section>
                <div className="max-w-5xl mx-auto">
                    <SectionHeader
                        title="The Hidden Cost of Manual Customer Support"
                        subtitle="Every missed call, delayed response, and repetitive question costs you time and money"
                    />

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Problems */}
                        <Card>
                            <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center">
                                <span className="mr-2">⚠️</span>
                                Without Automation
                            </h3>
                            <ul className="space-y-3">
                                {[
                                    "Missing leads because you can't answer 24/7",
                                    'Wasting hours answering the same questions',
                                    'Losing customers to faster competitors',
                                    'Unable to scale without hiring more staff',
                                    'Frustrated customers waiting for responses',
                                ].map((problem, index) => (
                                    <li key={index} className="flex items-start text-slate-700">
                                        <span className="text-red-500 mr-3 mt-1">✗</span>
                                        <span>{problem}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>

                        {/* Solutions */}
                        <Card className="bg-gradient-to-br from-brand-50 to-accent-50 border-brand-200">
                            <h3 className="text-xl font-bold text-brand-700 mb-4 flex items-center">
                                <span className="mr-2">✓</span>
                                With DreamWebApp AI
                            </h3>
                            <ul className="space-y-3">
                                {[
                                    'Capture leads 24/7, even while you sleep',
                                    'Answer FAQs instantly, automatically',
                                    'Convert more visitors into customers',
                                    'Scale infinitely without hiring',
                                    'Delight customers with instant responses',
                                ].map((benefit, index) => (
                                    <li key={index} className="flex items-start text-slate-800 font-medium">
                                        <span className="text-brand-600 mr-3 mt-1">✓</span>
                                        <span>{benefit}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    </div>
                </div>
            </Section>

            {/* Core Services */}
            <Section background="gray">
                <SectionHeader
                    title="Our Core Services"
                    subtitle="Everything you need to automate customer interactions and grow your business"
                />

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {featuredServices.map((service) => (
                        <ServiceCard key={service.id} service={service} />
                    ))}
                </div>

                <div className="text-center mt-12">
                    <Link to="/services">
                        <Button variant="primary" size="lg">
                            View All Services
                        </Button>
                    </Link>
                </div>
            </Section>

            {/* Who We Help */}
            <Section>
                <SectionHeader
                    title="Who We Help"
                    subtitle="Specialized solutions for different types of businesses"
                />

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {solutions.map((solution) => (
                        <Card key={solution.id} hover className="text-center">
                            <div className="text-5xl mb-4">{solution.icon}</div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">
                                {solution.title.replace('For ', '')}
                            </h3>
                            <p className="text-sm text-slate-600 mb-4">{solution.description}</p>
                            <Link to="/solutions">
                                <Button variant="outline" size="sm" fullWidth>
                                    Learn More
                                </Button>
                            </Link>
                        </Card>
                    ))}
                </div>
            </Section>

            {/* How It Works */}
            <Section background="gradient">
                <SectionHeader
                    title="How It Works"
                    subtitle="From discovery to launch in 4 simple steps"
                />

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                        {
                            step: '1',
                            title: 'Discovery Call',
                            description: 'We learn about your business, goals, and customer questions',
                            icon: '📞',
                        },
                        {
                            step: '2',
                            title: 'AI Training',
                            description: 'We train your custom AI on your content and business knowledge',
                            icon: '🧠',
                        },
                        {
                            step: '3',
                            title: 'Integration',
                            description: 'We integrate the chatbot into your website and tools',
                            icon: '🔗',
                        },
                        {
                            step: '4',
                            title: 'Launch & Optimize',
                            description: 'Go live and continuously improve based on real conversations',
                            icon: '🚀',
                        },
                    ].map((item) => (
                        <div key={item.step} className="text-center">
                            <div className="w-16 h-16 bg-brand-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                                {item.step}
                            </div>
                            <div className="text-4xl mb-4">{item.icon}</div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
                            <p className="text-slate-600">{item.description}</p>
                        </div>
                    ))}
                </div>
            </Section>

            {/* Tech & Payments */}
            <Section>
                <div className="max-w-4xl mx-auto text-center">
                    <SectionHeader
                        title="Built on Modern, Secure Technology"
                        subtitle="Fast, reliable, and secure infrastructure for your peace of mind"
                    />

                    <div className="grid md:grid-cols-3 gap-8 mb-12">
                        <Card>
                            <div className="text-3xl mb-3">⚡</div>
                            <h4 className="font-semibold text-slate-900 mb-2">Lightning Fast</h4>
                            <p className="text-sm text-slate-600">Hosted on Cloudflare's global network for instant responses worldwide</p>
                        </Card>
                        <Card>
                            <div className="text-3xl mb-3">🔒</div>
                            <h4 className="font-semibold text-slate-900 mb-2">Bank-Level Security</h4>
                            <p className="text-sm text-slate-600">Enterprise encryption and GDPR/CCPA compliance built-in</p>
                        </Card>
                        <Card>
                            <div className="text-3xl mb-3">💳</div>
                            <h4 className="font-semibold text-slate-900 mb-2">Flexible Payments</h4>
                            <p className="text-sm text-slate-600">Accept credit cards and major cryptocurrencies</p>
                        </Card>
                    </div>
                </div>
            </Section>

            {/* FAQ */}
            <Section background="gray">
                <div className="max-w-4xl mx-auto">
                    <SectionHeader
                        title="Frequently Asked Questions"
                        subtitle="Everything you need to know about our AI chatbots and automation"
                    />

                    <FAQList faqs={featuredFAQs} defaultOpenIndex={0} />

                    <div className="text-center mt-8">
                        <p className="text-slate-600 mb-4">Still have questions?</p>
                        <Link to="/contact">
                            <Button variant="secondary">Contact Us</Button>
                        </Link>
                    </div>
                </div>
            </Section>

            {/* Final CTA */}
            <Section background="gradient" padding="lg">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                        Ready to Automate Your Customer Support?
                    </h2>
                    <p className="text-xl text-slate-600 mb-8">
                        Join dozens of small businesses saving time and money with AI automation
                    </p>
                    <Link to="/contact">
                        <Button variant="accent" size="lg">
                            Book Your Free Demo Today
                        </Button>
                    </Link>
                </div>
            </Section>
        </>
    );
}
