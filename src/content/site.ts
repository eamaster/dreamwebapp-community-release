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

export interface SocialLink {
    name: string;
    url: string;
    icon: string;
}

export interface SiteContent {
    brand: {
        name: string;
        tagline: string;
        description: string;
    };
    navigation: NavigationItem[];
    footer: {
        sections: FooterSection[];
        socialLinks: SocialLink[];
        copyright: string;
    };
    contact: {
        email: string;
        phone?: string;
    };
}

export const siteContent: SiteContent = {
    brand: {
        name: 'DreamWebApp',
        tagline: 'AI Chatbots & Automation for Small Businesses',
        description:
            'Transform your customer experience with intelligent AI chatbots and automation services. Get 24/7 support, automated bookings, and more.',
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
            { name: 'Twitter', url: 'https://twitter.com/dreamwebapp', icon: '𝕏' },
            { name: 'LinkedIn', url: 'https://linkedin.com/company/dreamwebapp', icon: 'in' },
            { name: 'GitHub', url: 'https://github.com/dreamwebapp', icon: 'GH' },
        ],
        copyright: `© ${new Date().getFullYear()} DreamWebApp. All rights reserved.`,
    },
    contact: {
        email: 'hello@dreamwebapp.com',
        phone: '+1 (555) 123-4567',
    },
};
