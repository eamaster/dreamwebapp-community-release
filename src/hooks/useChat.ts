/**
 * Chat conversation state + mutation hook.
 *
 * Conversation state is kept in-memory only (component state) for the
 * current SPA session — nothing is written to localStorage/sessionStorage.
 * This is a deliberately conservative privacy stance: the project has an
 * existing localStorage pattern for the admin auth token, but no precedent
 * for persisting arbitrary visitor-authored content, so chat history is
 * treated as session-only and is cleared on page reload or "Start over".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { sendChatMessage, isApiError, type ChatAction, type ChatMessagePayload } from '@/lib/api-client';
import { validateRequired, validateLength } from '@/lib/validation';
import { appConfig } from '@/config/appConfig';

export const CHAT_MAX_MESSAGE_LENGTH = appConfig.form.maxMessageLength;

export interface ChatUiMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    status: 'sending' | 'sent' | 'error';
    action?: ChatAction;
    errorMessage?: string;
    degraded?: boolean;
}

function createMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function toHistoryPayload(messages: ChatUiMessage[]): ChatMessagePayload[] {
    return messages
        .filter((m) => m.status !== 'error')
        .map((m) => ({ role: m.role, content: m.content }));
}

export interface UseChatResult {
    messages: ChatUiMessage[];
    isSending: boolean;
    validationError: string | null;
    /** Returns true if the message passed validation and was dispatched. */
    sendMessage: (text: string) => boolean;
    retry: (messageId: string) => void;
    reset: () => void;
}

export function useChat(): UseChatResult {
    const [messages, setMessages] = useState<ChatUiMessage[]>([]);
    const [validationError, setValidationError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    const mutation = useMutation({
        mutationFn: (vars: { history: ChatMessagePayload[]; signal: AbortSignal }) =>
            sendChatMessage({ messages: vars.history }, vars.signal),
    });

    const isSending = mutation.isPending;

    const runSend = useCallback(
        (messageId: string, history: ChatMessagePayload[]) => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            mutation.mutate(
                { history, signal: controller.signal },
                {
                    onSuccess: (res) => {
                        setMessages((prev) => [
                            ...prev.map((m) => (m.id === messageId ? { ...m, status: 'sent' as const } : m)),
                            {
                                id: createMessageId(),
                                role: 'assistant',
                                content: res.reply,
                                status: 'sent' as const,
                                action: res.action,
                                degraded: res.degraded,
                            },
                        ]);
                    },
                    onError: (err) => {
                        const message = isApiError(err)
                            ? err.message
                            : 'Something went wrong. Please try again.';
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === messageId ? { ...m, status: 'error' as const, errorMessage: message } : m
                            )
                        );
                    },
                }
            );
        },
        [mutation]
    );

    const sendMessage = useCallback(
        (rawText: string): boolean => {
            if (isSending) return false; // guard against duplicate sends while a request is pending

            const text = rawText.trim();
            const requiredCheck = validateRequired(text, 'Message');
            if (!requiredCheck.isValid) {
                setValidationError(requiredCheck.error ?? 'Please enter a message.');
                return false;
            }
            const lengthCheck = validateLength(text, 1, CHAT_MAX_MESSAGE_LENGTH, 'Message');
            if (!lengthCheck.isValid) {
                setValidationError(lengthCheck.error ?? 'Message is too long.');
                return false;
            }
            setValidationError(null);

            const userMessage: ChatUiMessage = {
                id: createMessageId(),
                role: 'user',
                content: text,
                status: 'sending',
            };
            const next = [...messages, userMessage];
            setMessages(next);
            runSend(userMessage.id, toHistoryPayload(next));
            return true;
        },
        [isSending, messages, runSend]
    );

    const retry = useCallback(
        (messageId: string) => {
            if (isSending) return;
            const target = messages.find((m) => m.id === messageId);
            if (!target) return;

            const updated = messages.map((m) =>
                m.id === messageId ? { ...m, status: 'sending' as const, errorMessage: undefined } : m
            );
            setMessages(updated);
            runSend(messageId, toHistoryPayload(updated));
        },
        [isSending, messages, runSend]
    );

    const reset = useCallback(() => {
        abortRef.current?.abort();
        setMessages([]);
        setValidationError(null);
        mutation.reset();
    }, [mutation]);

    return { messages, isSending, validationError, sendMessage, retry, reset };
}
