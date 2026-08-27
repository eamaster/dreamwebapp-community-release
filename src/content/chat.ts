/**
 * Chat assistant content — single source of truth for:
 *  - the AI disclosure / scope statement shown in the chat panel
 *  - the centralized starter prompts (used by BOTH the chat panel's quick
 *    replies and the homepage "See what it can help with" section)
 *  - user-facing copy for the unavailable/error/handoff states
 *
 * Do not duplicate this list in other components — import from here.
 */

export interface ChatStarterPrompt {
    id: string;
    /** Short label shown as a chip inside the chat panel. */
    label: string;
    /** The actual message sent to the assistant when this prompt is used. */
    prompt: string;
    /** Icon used when this prompt is rendered as a homepage capability card. */
    icon: string;
    /** Outcome-oriented heading for the homepage capability card. */
    outcomeTitle: string;
    /** Outcome-oriented description for the homepage capability card. */
    outcomeDescription: string;
    /**
     * When set, selecting this prompt should route straight to the human
     * handoff flow instead of sending the message to the AI provider.
     */
    intent?: 'handoff';
}

export interface ChatContent {
    /** Role suffix appended to the brand name, e.g. "DreamWebApp AI Assistant". */
    assistantRoleLabel: string;
    /** Short, always-visible AI disclosure shown at the top of the chat panel. */
    disclosure: string;
    /** One-line description of what the assistant can and can't do. */
    scopeStatement: string;
    starterPrompts: ChatStarterPrompt[];
    /** Shown when the AI provider is unavailable/misconfigured or the request fails outright. */
    unavailableMessage: string;
    /** Shown above the inline handoff (lead capture) form. */
    handoffIntro: string;
    /** Label for the always-available "talk to a person" action. */
    handoffCtaLabel: string;
    /** Shown when a message fails to send (network/timeout/rate-limit/server). */
    sendErrorMessage: string;
    /** Placeholder text for the message input. */
    inputPlaceholder: string;
    /** Confirmation shown after a handoff/lead request is successfully submitted. */
    handoffSuccessMessage: string;
}

export const chatContent: ChatContent = {
    assistantRoleLabel: 'AI Assistant',
    disclosure: "I'm an AI assistant, not a human — here to help with quick questions.",
    scopeStatement:
        'I can answer questions about our services, solutions, pricing, and setup process, and connect you with our team for anything else.',
    starterPrompts: [
        {
            id: 'solution-fit',
            label: 'Which solution is right for my business?',
            prompt: 'Which solution is right for my business?',
            icon: '🎯',
            outcomeTitle: 'Recommends the right solution',
            outcomeDescription: 'Tell us about your business and get a tailored recommendation.',
        },
        {
            id: 'setup-scope',
            label: 'What does chatbot setup include?',
            prompt: 'What does chatbot setup include?',
            icon: '🤖',
            outcomeTitle: 'Explains services & setup',
            outcomeDescription: "See what's included and how long setup takes.",
        },
        {
            id: 'pricing',
            label: 'How much does it cost?',
            prompt: 'How much does it cost?',
            icon: '💰',
            outcomeTitle: 'Answers pricing questions',
            outcomeDescription: 'Get clear answers about plans and pricing.',
        },
        {
            id: 'talk-human',
            label: 'I want to speak to someone.',
            prompt: 'I want to speak to someone.',
            icon: '🙋',
            outcomeTitle: 'Connects you to a person',
            outcomeDescription: 'Prefer a human? Request a callback from our team.',
            intent: 'handoff',
        },
    ],
    unavailableMessage:
        "I'm temporarily unavailable to answer that right now. You're welcome to book a free demo or send us a message and we'll get back to you within 24 hours.",
    handoffIntro:
        "No problem — add a few details below and we'll get back to you. We've prefilled a short summary of this conversation so you don't have to repeat yourself.",
    handoffCtaLabel: 'Talk to a person',
    sendErrorMessage: "That message didn't send. Please check your connection and try again.",
    inputPlaceholder: 'Ask about services, pricing, or setup…',
    handoffSuccessMessage: "Thanks! We'll be in touch within 24 hours.",
};
