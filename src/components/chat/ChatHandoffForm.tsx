import { useMemo } from 'react';
import { ContactForm } from '@/components/contact/ContactForm';
import { chatContent } from '@/content/chat';
import { buildConversationSummary } from './chatUtils';
import type { ChatUiMessage } from '@/hooks/useChat';

export interface ChatHandoffFormProps {
    messages: ChatUiMessage[];
    onCancel: () => void;
    onSuccess: () => void;
}

/**
 * Inline human-handoff form shown inside the chat panel.
 * Reuses ContactForm (same validation, mutation, and confirmation UX as the
 * standalone contact page) with an editable, pre-filled conversation summary
 * so the visitor doesn't have to repeat themselves.
 */
export function ChatHandoffForm({ messages, onCancel, onSuccess }: ChatHandoffFormProps) {
    const summary = useMemo(() => buildConversationSummary(messages), [messages]);

    return (
        <div className="flex-1 overflow-y-auto px-4 py-4">
            <button
                type="button"
                onClick={onCancel}
                className="mb-3 inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
            >
                ← Back to chat
            </button>

            <p className="text-sm text-slate-600 mb-4">{chatContent.handoffIntro}</p>

            <ContactForm
                initialMessage={summary}
                source="chatbot"
                submitLabel="Send to our team"
                onSuccess={onSuccess}
                idPrefix="chat-"
            />
        </div>
    );
}
