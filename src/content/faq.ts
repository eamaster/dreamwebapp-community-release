/**
 * FAQ content
 */

export interface FAQItem {
    id: string;
    question: string;
    answer: string;
    category?: string;
}

export const faqs: FAQItem[] = [
    {
        id: 'setup-time',
        question: 'How long does it take to set up a chatbot?',
        answer:
            'Most chatbot setups are completed within 5-7 business days. This includes training the AI on your content, designing the conversation flows, integrating with your website, and thorough testing. More complex integrations like AI Receptionists may take 7-10 business days.',
        category: 'Setup',
    },
    {
        id: 'pricing-model',
        question: "What's included in the setup fee vs. monthly fee?",
        answer:
            'The setup fee covers initial chatbot creation, training, website integration, and configuration. Monthly fees (where applicable) cover hosting, ongoing optimization, content updates, monitoring, and support. You can choose a one-time setup with self-management, or add our Care & Optimization service for hands-off maintenance.',
        category: 'Pricing',
    },
    {
        id: 'content-updates',
        question: 'Can I update the chatbot content myself?',
        answer:
            'Yes! With the Starter Bot, you can make content updates yourself through our easy-to-use dashboard. If you prefer a hands-off approach, our Growth Bot + Care and Pro Automation plans include monthly professional updates and optimization by our team.',
        category: 'Management',
    },
    {
        id: 'integration',
        question: 'What platforms and tools do you integrate with?',
        answer:
            'We integrate with most popular platforms including WordPress, Shopify, Wix, Squarespace, Webflow, and custom websites. We can also connect to Google Calendar, Outlook, CRM systems (HubSpot, Salesforce, etc.), email platforms, and booking systems. Custom integrations are available for Pro plans.',
        category: 'Technical',
    },
    {
        id: 'training-data',
        question: 'What information do you need from me to train the chatbot?',
        answer:
            "We'll need access to your website content, FAQs, service descriptions, pricing information, and any other documentation about your business. We'll guide you through a simple onboarding process to gather everything needed. Most clients complete this in under an hour.",
        category: 'Setup',
    },
    {
        id: 'support',
        question: 'What kind of support do you provide?',
        answer:
            "All plans include email support with responses within 24 hours. Growth Bot + Care includes priority email support. Pro Automation includes a dedicated account manager with priority phone and chat support. We're here to ensure your chatbot delivers excellent results.",
        category: 'Support',
    },
    {
        id: 'crypto-payment',
        question: 'Do you accept cryptocurrency payments?',
        answer:
            "Yes! We accept major cryptocurrencies including Bitcoin, Ethereum, and USDC in addition to traditional credit card payments. Crypto payments are processed securely through our payment partners, and you'll receive the same service regardless of payment method.",
        category: 'Pricing',
    },
    {
        id: 'security',
        question: 'How secure is the chatbot and customer data?',
        answer:
            "Security is our top priority. All data is encrypted in transit and at rest. We use enterprise-grade infrastructure hosted on Cloudflare's global network for maximum speed and security. We're compliant with GDPR and CCPA, and we never sell or share your customer data.",
        category: 'Technical',
    },
    {
        id: 'refund-policy',
        question: "What's your refund policy?",
        answer:
            "We offer a 30-day satisfaction guarantee. If you're not happy with your chatbot within the first 30 days after launch, we'll refund your setup fee minus any custom integration work. Monthly subscriptions can be cancelled anytime with no cancellation fees.",
        category: 'Pricing',
    },
    {
        id: 'scaling',
        question: 'Can I upgrade or downgrade my plan later?',
        answer:
            "Absolutely! You can upgrade to a higher plan anytime. If you start with the Starter Bot and want to add our Care & Optimization service later, we'll prorate your first month. Downgrading is available at the end of your current billing period.",
        category: 'Management',
    },
    {
        id: 'languages',
        question: 'Can the chatbot support multiple languages?',
        answer:
            'Yes! Our chatbots can be trained to support multiple languages. The base setup includes one language, and additional languages can be added for $97/month per language. This is perfect for businesses serving diverse customer bases.',
        category: 'Technical',
    },
    {
        id: 'leads',
        question: 'How does lead capture work?',
        answer:
            'Our chatbots can collect contact information naturally during conversations. You can set up custom forms, email capture, phone number collection, and qualification questions. All leads are stored in your dashboard and can be exported or integrated directly into your CRM.',
        category: 'Features',
    },
];
