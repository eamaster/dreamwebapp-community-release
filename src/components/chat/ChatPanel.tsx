import { useEffect, useRef, useState } from 'react';
import { useSite } from '@/hooks/useContent';
import { chatContent } from '@/content/chat';
import { CHAT_MAX_MESSAGE_LENGTH } from '@/hooks/useChat';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useChatWidget } from './useChatWidget';
import { ChatMessageList } from './ChatMessageList';
import { ChatHandoffForm } from './ChatHandoffForm';

interface ChatComposerProps {
    initialValue: string;
    /** True when this mount was caused by a real pending prefill request (vs. a plain panel open). */
    hasPendingPrefill: boolean;
    isSending: boolean;
    validationError: string | null;
    sendMessage: (text: string) => boolean;
    consumePrefill: () => void;
    onStartOver: () => void;
    onOpenHandoff: () => void;
}

/**
 * Owns the composer's text value locally. The parent remounts this
 * component (via a `key` derived from the prefill request id) whenever a
 * new prefill request arrives, so the new text is picked up through this
 * component's initial state rather than by syncing a prop into state from
 * inside a `useEffect` — the mount-time effect below only acknowledges the
 * request and moves focus, it never calls a local state setter.
 */
function ChatComposer({
    initialValue,
    hasPendingPrefill,
    isSending,
    validationError,
    sendMessage,
    consumePrefill,
    onStartOver,
    onOpenHandoff,
}: ChatComposerProps) {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (hasPendingPrefill) consumePrefill();
        inputRef.current?.focus();
    }, [hasPendingPrefill, consumePrefill]);

    const isOverLimit = value.length > CHAT_MAX_MESSAGE_LENGTH;
    const canSend = value.trim().length > 0 && !isOverLimit && !isSending;

    const handleSend = () => {
        if (!value.trim() || isSending) return;
        const accepted = sendMessage(value);
        if (accepted) setValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleStartOverClick = () => {
        setValue('');
        onStartOver();
    };

    return (
        <>
            {validationError && (
                <p className="px-4 text-xs text-red-600" role="alert">
                    {validationError}
                </p>
            )}

            <div className="border-t border-slate-200 p-3">
                <div className="flex items-end gap-2">
                    <label htmlFor="chat-input" className="sr-only">
                        Message
                    </label>
                    <textarea
                        id="chat-input"
                        ref={inputRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={chatContent.inputPlaceholder}
                        rows={1}
                        maxLength={CHAT_MAX_MESSAGE_LENGTH + 50}
                        className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!canSend}
                        aria-label="Send message"
                        className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                        </svg>
                    </button>
                </div>
                {isOverLimit && (
                    <p className="mt-1 text-xs text-red-600">
                        Message must be under {CHAT_MAX_MESSAGE_LENGTH} characters ({value.length}/{CHAT_MAX_MESSAGE_LENGTH}).
                    </p>
                )}

                <div className="flex items-center justify-between mt-2">
                    <button
                        type="button"
                        onClick={handleStartOverClick}
                        className="text-xs font-medium text-slate-500 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
                    >
                        Start over
                    </button>
                    <button
                        type="button"
                        onClick={onOpenHandoff}
                        className="text-xs font-semibold text-brand-700 hover:text-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
                    >
                        {chatContent.handoffCtaLabel}
                    </button>
                </div>
            </div>
        </>
    );
}

export function ChatPanel() {
    const {
        isOpen,
        view,
        close,
        openHandoff,
        closeHandoff,
        messages,
        isSending,
        validationError,
        sendMessage,
        retry,
        reset,
        prefillRequest,
        hasPendingPrefill,
        consumePrefill,
    } = useChatWidget();
    const { data: site } = useSite();

    const [handoffSubmitted, setHandoffSubmitted] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const brandName = site?.brand?.name || 'DreamWebApp';
    const assistantName = `${brandName} ${chatContent.assistantRoleLabel}`;
    const isHandoffView = view === 'handoff';

    useFocusTrap(panelRef, isOpen);

    // Focus a meaningful control whenever the panel switches into the
    // handoff view: the first form field. (The chat-view composer focuses
    // itself on mount — see ChatComposer above — which covers both "panel
    // opened" and "new prefill applied".)
    useEffect(() => {
        if (!isOpen || !isHandoffView) return;
        const firstField = panelRef.current?.querySelector<HTMLElement>('#chat-name');
        firstField?.focus();
    }, [isOpen, isHandoffView]);

    if (!isOpen) return null;

    const handleStarterPrompt = (prompt: { prompt: string; intent?: 'handoff' }) => {
        if (prompt.intent === 'handoff') {
            openHandoff();
            return;
        }
        sendMessage(prompt.prompt);
    };

    const handleEscape = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            close();
        }
    };

    const handleStartOver = () => {
        reset();
        closeHandoff();
        setHandoffSubmitted(false);
    };

    return (
        <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-panel-title"
            onKeyDown={handleEscape}
            className="fixed z-50 bg-white shadow-2xl border border-slate-200 flex flex-col inset-x-0 bottom-0 max-h-[90vh] h-[85vh] rounded-t-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:max-h-[80vh] sm:w-[380px] sm:rounded-2xl"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-brand-50 to-accent-50 rounded-t-2xl">
                <div>
                    <h2 id="chat-panel-title" className="text-sm font-bold text-slate-900">
                        {assistantName}
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">{chatContent.disclosure}</p>
                </div>
                <button
                    type="button"
                    onClick={close}
                    aria-label="Close chat"
                    className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {isHandoffView ? (
                handoffSubmitted ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8">
                        <div className="text-4xl mb-3">✓</div>
                        <p className="text-slate-800 font-semibold mb-1">Request sent</p>
                        <p className="text-sm text-slate-600 mb-6">{chatContent.handoffSuccessMessage}</p>
                        <button
                            type="button"
                            onClick={handleStartOver}
                            className="text-sm font-semibold text-brand-700 hover:text-brand-800 underline focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
                        >
                            Back to chat
                        </button>
                    </div>
                ) : (
                    <ChatHandoffForm
                        messages={messages}
                        onCancel={closeHandoff}
                        onSuccess={() => setHandoffSubmitted(true)}
                    />
                )
            ) : (
                <>
                    {messages.length === 0 && (
                        <div className="px-4 py-3 border-b border-slate-100">
                            <p className="text-xs text-slate-500 mb-3">{chatContent.scopeStatement}</p>
                            <div className="flex flex-col gap-2">
                                {chatContent.starterPrompts.map((sp) => (
                                    <button
                                        key={sp.id}
                                        type="button"
                                        onClick={() => handleStarterPrompt(sp)}
                                        disabled={isSending}
                                        className="text-left text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {sp.icon} {sp.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <ChatMessageList
                        messages={messages}
                        isSending={isSending}
                        onRetry={retry}
                        onHandoffAction={openHandoff}
                    />

                    <ChatComposer
                        key={prefillRequest?.id ?? 'default'}
                        initialValue={hasPendingPrefill ? prefillRequest?.text ?? '' : ''}
                        hasPendingPrefill={hasPendingPrefill}
                        isSending={isSending}
                        validationError={validationError}
                        sendMessage={sendMessage}
                        consumePrefill={consumePrefill}
                        onStartOver={handleStartOver}
                        onOpenHandoff={openHandoff}
                    />
                </>
            )}
        </div>
    );
}
