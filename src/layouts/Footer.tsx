import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '@/hooks/useContent';
import { SocialIcon } from '@/components/common/SocialIcon';
import { getSocialAccessibleName } from '@/lib/social';
import { formatPhoneDisplay, toTelHref } from '@/lib/phone';
import { env } from '@/config/env';

const STATIC_LOGO_SRC = '/dreamwebapp_logo.png';

/**
 * Site Footer component
 * Dynamic multi-column footer powered by useSite hook
 */
export function Footer() {
    const { data: site } = useSite();
    const [logoErrored, setLogoErrored] = useState(false);

    const brandName = site?.brand?.name || 'DreamWebApp';
    const brandTagline = site?.brand?.tagline || 'AI-Powered Chatbots & Automations for Small Business';
    const socialLinks = (site?.footer?.socialLinks || []).filter((s) => s.enabled);
    const sections = site?.footer?.sections || [];
    const contactEmail = site?.contact?.email || 'hello@dreamwebapp.com';
    const contactPhone = site?.contact?.phone;
    const phoneDisplay = formatPhoneDisplay(contactPhone);
    const phoneHref = toTelHref(contactPhone);
    const copyright = site?.footer?.copyright || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`;

    const footerLogoUrl = site?.brand?.footerLogoUrl ? `${env.apiBaseUrl}${site.brand.footerLogoUrl}` : null;
    const logoSrc = footerLogoUrl && !logoErrored ? footerLogoUrl : STATIC_LOGO_SRC;

    return (
        <footer className="bg-slate-900 text-slate-300">
            {/* Main Footer Content */}
            <div className="container-custom py-12 md:py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
                    {/* Brand Section */}
                    <div className="lg:col-span-1">
                        <Link to="/" className="inline-block mb-4">
                            <img
                                src={logoSrc}
                                alt={brandName}
                                onError={() => setLogoErrored(true)}
                                className={`h-10 w-auto ${footerLogoUrl && !logoErrored ? '' : 'brightness-0 invert opacity-90'}`}
                            />
                        </Link>
                        <p className="text-slate-400 mb-6 leading-relaxed">
                            {brandTagline}
                        </p>

                        {/* Social Links */}
                        {socialLinks.length > 0 && (
                            <div className="flex items-center space-x-4">
                                {socialLinks.map((social) => (
                                    <a
                                        key={social.id}
                                        href={social.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-11 h-11 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-brand-600 transition-colors duration-200"
                                        aria-label={getSocialAccessibleName(social.platform, social.label)}
                                    >
                                        <SocialIcon platform={social.platform} />
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer Sections */}
                    {sections.map((section) => (
                        <div key={section.title}>
                            <h3 className="text-white font-semibold text-lg mb-4">{section.title}</h3>
                            <ul className="space-y-3">
                                {section.links.map((link) => (
                                    <li key={link.path}>
                                        <Link
                                            to={link.path}
                                            className="text-slate-400 hover:text-brand-400 transition-colors duration-200"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {/* Contact Section */}
                    <div>
                        <h3 className="text-white font-semibold text-lg mb-4">Get in Touch</h3>
                        <ul className="space-y-3 text-slate-400">
                            <li>
                                <a
                                    href={`mailto:${contactEmail}`}
                                    className="hover:text-brand-400 transition-colors duration-200"
                                >
                                    {contactEmail}
                                </a>
                            </li>
                            {phoneDisplay && phoneHref && (
                                <li>
                                    <a
                                        href={phoneHref}
                                        className="hover:text-brand-400 transition-colors duration-200"
                                    >
                                        {phoneDisplay}
                                    </a>
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-slate-800">
                <div className="container-custom py-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-slate-500 text-sm">{copyright}</p>
                        <div className="flex items-center gap-6 text-sm">
                            <Link
                                to="/privacy-policy"
                                className="text-slate-500 hover:text-brand-400 transition-colors"
                            >
                                Privacy Policy
                            </Link>
                            <Link
                                to="/terms-of-service"
                                className="text-slate-500 hover:text-brand-400 transition-colors"
                            >
                                Terms of Service
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
