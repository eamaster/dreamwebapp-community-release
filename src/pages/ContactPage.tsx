import { Section, SectionHeader } from '@/components/common/Section';
import { ContactForm } from '@/components/contact/ContactForm';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { useSite } from '@/hooks/useContent';
import { useOptionalChatWidget } from '@/components/chat/useChatWidget';
import { formatPhoneDisplay, toTelHref } from '@/lib/phone';

/**
 * Contact Page
 * Contact form and dynamic company contact information powered by useSite
 */
export function ContactPage() {
    const { data: site } = useSite();
    const chatWidget = useOptionalChatWidget();

    const contactEmail = site?.contact?.email || 'hello@dreamwebapp.com';
    const phoneDisplay = formatPhoneDisplay(site?.contact?.phone);
    const phoneHref = toTelHref(site?.contact?.phone);

    return (
        <>
            {/* Page Header */}
            <Section background="gradient" padding="md">
                <div className="text-center max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                        Let's <span className="gradient-text">Talk</span>
                    </h1>
                    <p className="text-xl text-slate-600">
                        Book a free demo or get in touch with our team
                    </p>
                </div>
            </Section>

            {/* Contact Form and Info */}
            <Section>
                <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
                    {/* Left: Contact Form */}
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">
                            Book Your Free Demo
                        </h2>
                        <p className="text-slate-600 mb-8">
                            Fill out the form below and we'll get back to you within 24 hours to schedule your personalized demo.
                        </p>
                        <ContactForm />
                    </div>

                    {/* Right: Contact Info */}
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">
                            Other Ways to Reach Us
                        </h2>

                        <div className="space-y-6 mb-8">
                            <Card>
                                <div className="flex items-start gap-4">
                                    <div className="text-3xl">📧</div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 mb-1">Email Us</h3>
                                        <a
                                            href={`mailto:${contactEmail}`}
                                            className="text-brand-600 hover:text-brand-700"
                                        >
                                            {contactEmail}
                                        </a>
                                        <p className="text-sm text-slate-600 mt-1">
                                            We typically respond within 24 hours
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            {phoneDisplay && phoneHref && (
                                <Card>
                                    <div className="flex items-start gap-4">
                                        <div className="text-3xl">📞</div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900 mb-1">Call Us</h3>
                                            <a
                                                href={phoneHref}
                                                className="text-brand-600 hover:text-brand-700"
                                            >
                                                {phoneDisplay}
                                            </a>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {chatWidget && (
                                <Card>
                                    <div className="flex items-start gap-4">
                                        <div className="text-3xl">💬</div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-900 mb-1">Chat with our AI Assistant</h3>
                                            <p className="text-slate-600 mb-3">
                                                Get instant answers about services, pricing, and setup — or ask to speak with our team.
                                            </p>
                                            <Button variant="outline" size="sm" onClick={() => chatWidget.open()}>
                                                Open AI Assistant
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>

                        {/* What to Expect */}
                        <div className="bg-brand-50 rounded-xl p-6 border border-brand-200">
                            <h3 className="font-semibold text-slate-900 mb-4">What to Expect:</h3>
                            <ul className="space-y-3">
                                <li className="flex items-start text-sm text-slate-700">
                                    <span className="text-brand-600 mr-2 mt-0.5">1.</span>
                                    <span>We'll review your business and goals</span>
                                </li>
                                <li className="flex items-start text-sm text-slate-700">
                                    <span className="text-brand-600 mr-2 mt-0.5">2.</span>
                                    <span>Show you a live demo tailored to your needs</span>
                                </li>
                                <li className="flex items-start text-sm text-slate-700">
                                    <span className="text-brand-600 mr-2 mt-0.5">3.</span>
                                    <span>Answer all your questions</span>
                                </li>
                                <li className="flex items-start text-sm text-slate-700">
                                    <span className="text-brand-600 mr-2 mt-0.5">4.</span>
                                    <span>Provide a custom quote (no pressure!)</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </Section>

            {/* FAQ */}
            <Section background="gray">
                <div className="max-w-3xl mx-auto">
                    <SectionHeader
                        title="Common Questions"
                        subtitle="Quick answers before you reach out"
                    />

                    <div className="space-y-4">
                        <Card>
                            <h3 className="font-semibold text-slate-900 mb-2">
                                How long does the demo take?
                            </h3>
                            <p className="text-slate-600 text-sm">
                                Typically 20-30 minutes. We'll keep it focused and valuable for your time.
                            </p>
                        </Card>

                        <Card>
                            <h3 className="font-semibold text-slate-900 mb-2">
                                Is there any obligation after the demo?
                            </h3>
                            <p className="text-slate-600 text-sm">
                                None whatsoever! We'll provide information and a quote, but there's zero pressure to move forward.
                            </p>
                        </Card>

                        <Card>
                            <h3 className="font-semibold text-slate-900 mb-2">
                                Can I see examples from my industry?
                            </h3>
                            <p className="text-slate-600 text-sm">
                                Absolutely! Let us know your industry in the form, and we'll prepare relevant examples for your demo.
                            </p>
                        </Card>
                    </div>
                </div>
            </Section>
        </>
    );
}
