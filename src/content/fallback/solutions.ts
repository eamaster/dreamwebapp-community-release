/**
 * Solutions content
 * Niche-specific solutions and their benefits
 */

export interface Solution {
    id: string;
    title: string;
    icon: string;
    description: string;
    pains: string[];
    benefits: string[];
    ctaText: string;
}

export const solutions: Solution[] = [
    {
        id: 'clinics',
        title: 'For Clinics & Healthcare',
        icon: '🏥',
        description:
            'Reduce administrative burden and improve patient experience with AI-powered automation.',
        pains: [
            'Phone lines constantly busy with appointment requests and basic questions',
            'Staff overwhelmed with repetitive inquiries about hours, insurance, and services',
            'Missed appointments and no-shows hurting revenue',
            'Patients frustrated waiting for responses outside office hours',
        ],
        benefits: [
            'Automate appointment booking and rescheduling 24/7',
            'Instantly answer common questions about services, insurance, and office hours',
            'Send automated reminders to reduce no-shows by up to 40%',
            'Free up staff to focus on in-person patient care',
            'Capture after-hours inquiries and convert them into appointments',
        ],
        ctaText: 'Get Your AI Receptionist',
    },
    {
        id: 'local-services',
        title: 'For Local Services',
        icon: '💇',
        description:
            'Salons, spas, pet groomers, and local service businesses: never miss a booking again.',
        pains: [
            'Losing customers to competitors who offer online booking',
            'Missing calls and potential bookings while serving clients',
            'Spending too much time on phone scheduling instead of serving customers',
            'Difficult to manage bookings across multiple team members',
        ],
        benefits: [
            "Let clients book services anytime, even when you're busy",
            "Automatically sync appointments across your team's calendars",
            'Answer service and pricing questions instantly',
            'Send booking confirmations and reminders automatically',
            'Increase bookings by 25-35% with 24/7 availability',
        ],
        ctaText: 'Automate Your Bookings',
    },
    {
        id: 'course-creators',
        title: 'For Course Creators',
        icon: '🎓',
        description:
            'Scale your online course business without hiring a support team.',
        pains: [
            'Drowning in the same student questions over and over',
            "Can't scale because you spend all day answering emails",
            'Students frustrated waiting hours or days for simple answers',
            "Missing course sales because you can't respond to inquiries fast enough",
        ],
        benefits: [
            'Instantly answer common student questions about course content, enrollment, and access',
            'Automate course enrollment and payment FAQs',
            'Support students 24/7 across all time zones',
            'Free yourself to focus on creating content and teaching',
            'Convert more course inquiries into enrollments with instant responses',
        ],
        ctaText: 'Scale Your Course Business',
    },
    {
        id: 'online-shops',
        title: 'For Online Shops',
        icon: '🛒',
        description:
            'Boost sales and reduce cart abandonment with intelligent automation.',
        pains: [
            'High cart abandonment rates—customers leave with questions unanswered',
            "Can't afford 24/7 customer support team",
            'Losing sales to competitors with better support',
            'Overwhelmed by shipping, return, and product questions',
        ],
        benefits: [
            'Answer product questions instantly to close more sales',
            'Recover abandoned carts with automated follow-up',
            'Handle shipping, returns, and order tracking automatically',
            'Provide 24/7 support without hiring night shift staff',
            'Increase conversion rates by 15-25% with instant assistance',
        ],
        ctaText: 'Boost Your Sales',
    },
];
