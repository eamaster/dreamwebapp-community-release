/**
 * Site-wide content and configuration
 * Centralizes all brand, navigation, and contact information
 */

export interface NavigationItem {
    label: string;
    path: string;
}

export interface FooterSection {
    title: string;
    links: NavigationItem[];
}

export type SocialPlatform =
    | 'twitter' | 'linkedin' | 'facebook' | 'instagram'
    | 'youtube' | 'tiktok' | 'github' | 'other';

export interface SocialLink {
    id: string;
    platform: SocialPlatform;
    label?: string;
    url: string;
    enabled: boolean;
    sortOrder: number;
}

export interface SiteContent {
    brand: {
        name: string;
        tagline: string;
        description: string;
        headerLogoUrl?: string | null;
        footerLogoUrl?: string | null;
    };
    navigation: NavigationItem[];
    footer: {
        sections: FooterSection[];
        socialLinks: SocialLink[];
        copyright: string;
    };
    contact: {
        email: string;
        /** E.164 format, e.g. "+15551234567" */
        phone?: string;
    };
}

export const siteContent: SiteContent = {
    brand: {
        name: 'DreamWebApp',
        tagline: 'AI Chatbots & Automation for Small Businesses',
        description:
            'Transform your customer experience with intelligent AI chatbots and automation services. Get 24/7 support, automated bookings, and more.',
        headerLogoUrl: null,
        footerLogoUrl: null,
    },
    navigation: [
        { label: 'Home', path: '/' },
        { label: 'Services', path: '/services' },
        { label: 'Solutions', path: '/solutions' },
        { label: 'Pricing', path: '/pricing' },
        { label: 'About', path: '/about' },
        { label: 'Contact', path: '/contact' },
    ],
    footer: {
        sections: [
            {
                title: 'Services',
                links: [
                    { label: 'AI Website Chatbot', path: '/services#chatbot' },
                    { label: 'Chatbot Care & Optimization', path: '/services#care' },
                    { label: 'AI Receptionist', path: '/services#receptionist' },
                    { label: 'Automation Add-ons', path: '/services#automation' },
                ],
            },
            {
                title: 'Solutions',
                links: [
                    { label: 'For Clinics', path: '/solutions#clinics' },
                    { label: 'For Local Services', path: '/solutions#local-services' },
                    { label: 'For Course Creators', path: '/solutions#course-creators' },
                    { label: 'For Online Shops', path: '/solutions#online-shops' },
                ],
            },
            {
                title: 'Company',
                links: [
                    { label: 'About Us', path: '/about' },
                    { label: 'Pricing', path: '/pricing' },
                    { label: 'Contact', path: '/contact' },
                ],
            },
        ],
        socialLinks: [
            { id: 'twitter', platform: 'twitter', url: 'https://twitter.com/dreamwebapp', enabled: true, sortOrder: 0 },
            { id: 'linkedin', platform: 'linkedin', url: 'https://linkedin.com/company/dreamwebapp', enabled: true, sortOrder: 1 },
            { id: 'github', platform: 'github', url: 'https://github.com/dreamwebapp', enabled: true, sortOrder: 2 },
        ],
        copyright: `© ${new Date().getFullYear()} DreamWebApp. All rights reserved.`,
    },
    contact: {
        email: 'hello@dreamwebapp.com',
        phone: '+15551234567',
    },
};
