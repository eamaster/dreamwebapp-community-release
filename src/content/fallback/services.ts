/**
 * Services content
 * All service offerings and their details
 */

export interface Service {
    id: string;
    name: string;
    shortDescription: string;
    longDescription: string;
    whoItsFor: string[];
    included: string[];
    timeline: string;
    pricing: {
        type: 'one-time' | 'monthly' | 'custom';
        amount?: number;
        note?: string;
    };
    icon: string;
}

export const services: Service[] = [
    {
        id: 'chatbot-setup',
        name: 'AI Website Chatbot Setup',
        shortDescription: 'Get a custom AI chatbot on your website in days',
        longDescription:
            'Launch a powerful AI chatbot trained on your business data. Handle FAQs, capture leads, and provide 24/7 customer support automatically.',
        whoItsFor: [
            'Small businesses wanting to automate customer support',
            'Service providers tired of answering the same questions',
            'E-commerce stores looking to boost conversions',
            'Any business missing leads outside business hours',
        ],
        included: [
            'Custom chatbot trained on your content',
            'Seamless website integration',
            'Lead capture & email collection',
            'FAQ automation',
            'Mobile-responsive design',
            'Analytics dashboard',
        ],
        timeline: '5-7 business days',
        pricing: {
            type: 'one-time',
            amount: 997,
            note: 'One-time setup fee',
        },
        icon: '🤖',
    },
    {
        id: 'chatbot-care',
        name: 'AI Chatbot Care & Optimization',
        shortDescription: 'Monthly maintenance, updates, and performance optimization',
        longDescription:
            'Keep your chatbot running smoothly with ongoing hosting, monitoring, content updates, and performance improvements.',
        whoItsFor: [
            'Businesses with an existing AI chatbot',
            'Companies wanting hands-off chatbot management',
            'Organizations needing regular content updates',
            'Teams looking to improve chatbot performance over time',
        ],
        included: [
            'Secure hosting & uptime monitoring',
            'Monthly content & training updates',
            'Performance analytics & reporting',
            'Bug fixes & technical support',
            'Conversation flow optimization',
            'Priority email support',
        ],
        timeline: 'Ongoing monthly service',
        pricing: {
            type: 'monthly',
            amount: 197,
            note: 'Per month',
        },
        icon: '⚙️',
    },
    {
        id: 'ai-receptionist-clinics',
        name: 'AI Receptionist for Clinics & Local Services',
        shortDescription: 'Automated appointment booking and patient/client support',
        longDescription:
            'Purpose-built AI receptionist for healthcare clinics, salons, spas, and local service businesses. Handles bookings, answers questions, and reduces no-shows.',
        whoItsFor: [
            'Medical, dental, and therapy clinics',
            'Salons, spas, and wellness centers',
            'Pet grooming and veterinary services',
            'Any appointment-based local business',
        ],
        included: [
            'Appointment scheduling automation',
            'Service & pricing information',
            'Insurance & payment FAQ handling',
            'Patient/client intake forms',
            'Reminder & follow-up messages',
            'Calendar integration (Google/Outlook)',
        ],
        timeline: '7-10 business days',
        pricing: {
            type: 'custom',
            note: 'Starting at $1,497 setup + $297/mo',
        },
        icon: '📅',
    },
    {
        id: 'ai-receptionist-courses',
        name: 'AI Receptionist for Course Creators',
        shortDescription: 'Automated student support and course enrollment',
        longDescription:
            'Specialized AI assistant for online course creators and educators. Answers course questions, handles enrollments, and supports students 24/7.',
        whoItsFor: [
            'Online course creators & educators',
            'Coaching and mentorship programs',
            'Training and certification providers',
            'Membership communities',
        ],
        included: [
            'Course FAQ automation',
            'Enrollment & pricing support',
            'Student onboarding assistance',
            'Learning platform integration',
            'Payment & access troubleshooting',
            'Community engagement support',
        ],
        timeline: '7-10 business days',
        pricing: {
            type: 'custom',
            note: 'Starting at $1,297 setup + $247/mo',
        },
        icon: '🎓',
    },
    {
        id: 'automation-inbox',
        name: 'Inbox & FAQ Automation',
        shortDescription: 'Auto-respond to common emails and inquiries',
        longDescription:
            'Automatically handle repetitive email inquiries, route complex questions to the right team, and provide instant responses to FAQs.',
        whoItsFor: [
            'Businesses drowning in repetitive emails',
            'Support teams wanting to focus on complex issues',
            'Companies with high inquiry volume',
        ],
        included: [
            'Email automation setup',
            'Smart inbox routing',
            'Auto-response templates',
            'FAQ knowledge base',
            'Integration with Gmail/Outlook',
        ],
        timeline: '5-7 business days',
        pricing: {
            type: 'one-time',
            amount: 697,
            note: 'Setup fee (monthly hosting available)',
        },
        icon: '📧',
    },
    {
        id: 'automation-booking',
        name: 'Appointment & Booking Automation',
        shortDescription: 'Streamline scheduling and reduce no-shows',
        longDescription:
            'Full-featured booking automation with calendar sync, automated reminders, rescheduling, and cancellation handling.',
        whoItsFor: [
            'Service providers with appointment-based business',
            'Consultants and professionals',
            'Event organizers',
        ],
        included: [
            'Automated appointment booking',
            'Calendar synchronization',
            'Reminder & confirmation emails',
            'Rescheduling & cancellation handling',
            'Timezone management',
            'No-show reduction features',
        ],
        timeline: '7-10 business days',
        pricing: {
            type: 'one-time',
            amount: 897,
            note: 'Setup fee + $97/mo management',
        },
        icon: '🗓️',
    },
];
