import { useState } from 'react';
import type { FAQItem } from '@/lib/api-client';

export interface FAQItemProps {
    faq: FAQItem;
    defaultOpen?: boolean;
}

/**
 * FAQ Accordion Item component
 * Expandable FAQ item with smooth animations
 */
export function FAQAccordionItem({ faq, defaultOpen = false }: FAQItemProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden hover:border-brand-300 transition-colors duration-200">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-6 py-4 flex items-center justify-between text-left bg-white hover:bg-slate-50 transition-colors duration-200"
                aria-expanded={isOpen}
            >
                <span className="text-lg font-semibold text-slate-900 pr-4">
                    {faq.question}
                </span>
                <svg
                    className={`w-5 h-5 text-brand-600 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''
                        }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>

            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <p className="text-slate-700 leading-relaxed">{faq.answer}</p>
                </div>
            </div>
        </div>
    );
}

export interface FAQListProps {
    faqs: FAQItem[];
    defaultOpenIndex?: number;
}

/**
 * FAQ List component
 * Renders a list of FAQ accordion items
 */
export function FAQList({ faqs, defaultOpenIndex }: FAQListProps) {
    return (
        <div className="space-y-4">
            {faqs.map((faq, index) => (
                <FAQAccordionItem
                    key={faq.id}
                    faq={faq}
                    defaultOpen={index === defaultOpenIndex}
                />
            ))}
        </div>
    );
}
