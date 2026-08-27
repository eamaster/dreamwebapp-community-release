import type { ChatUiMessage } from '@/hooks/useChat';

const MAX_SUMMARY_LENGTH = 800;

/**
 * Builds a short, editable summary of the conversation so a visitor
 * requesting human follow-up doesn't have to repeat themselves.
 * Only successfully-exchanged messages are included; failed/pending ones
 * are omitted. Keeps the most recent context within the length budget.
 */
export function buildConversationSummary(messages: ChatUiMessage[]): string {
    const relevant = messages.filter((m) => m.status === 'sent');
    if (relevant.length === 0) return '';

    const lines: string[] = [];
    let totalLength = 0;

    for (let i = relevant.length - 1; i >= 0; i--) {
        const message = relevant[i];
        if (!message) continue;
        const line = `${message.role === 'user' ? 'Me' : 'Assistant'}: ${message.content}`;
        if (totalLength + line.length > MAX_SUMMARY_LENGTH && lines.length > 0) break;
        lines.unshift(line);
        totalLength += line.length + 1;
    }

    return lines.join('\n');
}
