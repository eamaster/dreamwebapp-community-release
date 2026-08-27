/**
 * Pricing plans content
 */

export interface PricingPlan {
    id: string;
    name: string;
    description: string;
    monthlyPrice: number;
    setupFee?: number;
    bestFor: string;
    features: string[];
    highlighted: boolean;
    ctaText: string;
    badge?: string;
}

export const pricingPlans: PricingPlan[] = [
    {
        id: 'starter-bot',
        name: 'Starter Bot',
        description: 'Perfect for small businesses getting started with AI automation',
        monthlyPrice: 0,
        setupFee: 997,
        bestFor: 'Small businesses with basic FAQ and lead capture needs',
        features: [
            'Custom AI chatbot trained on your content',
            'Website integration & setup',
            'FAQ automation (up to 50 Q&As)',
            'Lead capture & email collection',
            'Basic analytics dashboard',
            'Email support',
            'Monthly content updates (self-service)',
        ],
        highlighted: false,
        ctaText: 'Get Started',
    },
    {
        id: 'growth-bot',
        name: 'Growth Bot + Care',
        description: 'Full-service chatbot with ongoing optimization and support',
        monthlyPrice: 197,
        setupFee: 997,
        bestFor: 'Growing businesses wanting hands-off chatbot management',
        features: [
            'Everything in Starter Bot',
            'Secure hosting & uptime monitoring',
            'Monthly content & training updates',
            'Advanced analytics & reporting',
            'Conversation flow optimization',
            'Priority email support',
            'Performance improvement recommendations',
            'Quarterly strategy calls',
        ],
        highlighted: true,
        ctaText: 'Most Popular',
        badge: 'RECOMMENDED',
    },
    {
        id: 'pro-automation',
        name: 'Pro Automation Suite',
        description: 'Complete automation ecosystem with AI receptionist & workflows',
        monthlyPrice: 497,
        setupFee: 1997,
        bestFor: 'Established businesses ready to fully automate customer interactions',
        features: [
            'Everything in Growth Bot + Care',
            'AI Receptionist with appointment booking',
            'Advanced automation workflows',
            'Multi-channel support (chat, email, SMS)',
            'CRM & calendar integration',
            'Custom integrations & API access',
            'Dedicated account manager',
            'White-glove onboarding',
            'Monthly optimization sessions',
            'Priority phone & chat support',
        ],
        highlighted: false,
        ctaText: 'Go Pro',
    },
];

/**
 * Add-on services
 */
export interface AddOn {
    id: string;
    name: string;
    description: string;
    price: number;
    priceType: 'one-time' | 'monthly';
}

export const addOns: AddOn[] = [
    {
        id: 'inbox-automation',
        name: 'Inbox & FAQ Automation',
        description: 'Auto-respond to emails and route complex questions',
        price: 697,
        priceType: 'one-time',
    },
    {
        id: 'booking-automation',
        name: 'Appointment Booking Automation',
        description: 'Full booking system with reminders and calendar sync',
        price: 897,
        priceType: 'one-time',
    },
    {
        id: 'multilingual',
        name: 'Multilingual Support',
        description: 'Support for additional languages (per language)',
        price: 97,
        priceType: 'monthly',
    },
    {
        id: 'custom-integration',
        name: 'Custom Integration',
        description: 'Connect to your existing tools and systems',
        price: 497,
        priceType: 'one-time',
    },
];
