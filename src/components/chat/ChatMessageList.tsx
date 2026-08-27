import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { ChatUiMessage } from '@/hooks/useChat';

export interface ChatMessageListProps {
    messages: ChatUiMessage[];
    isSending: boolean;
    onRetry: (messageId: string) => void;
    onHandoffAction: () => void;
}

export function ChatMessageList({ messages, isSending, onRetry, onHandoffAction }: ChatMessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages.length, isSending]);

    return (
        <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar"
            role="log"
            aria-live="polite"
            aria-label="Conversation"
        >
            {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%]">
                        <div
                            className={
                                message.role === 'user'
                                    ? 'rounded-2xl rounded-br-sm bg-brand-600 text-white px-4 py-2.5 text-sm leading-relaxed'
                                    : 'rounded-2xl rounded-bl-sm bg-slate-100 text-slate-800 px-4 py-2.5 text-sm leading-relaxed'
                            }
                        >
                            {message.content}
                        </div>

                        {message.status === 'error' && (
                            <div className="mt-1.5 flex items-center gap-2 text-xs text-red-600">
                                <span>⚠ {message.errorMessage ?? 'Failed to send.'}</span>
                                <button
                                    type="button"
                                    onClick={() => onRetry(message.id)}
                                    className="font-semibold underline hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {message.action && (
                            <div className="mt-2">
                                {message.action.type === 'handoff' ? (
                                    <button
                                        type="button"
                                        onClick={onHandoffAction}
                                        className="inline-flex items-center text-sm font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    >
                                        {message.action.label}
                                    </button>
                                ) : (
                                    <Link
                                        to={message.action.path}
                                        className="inline-flex items-center text-sm font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    >
                                        {message.action.label}
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {isSending && (
                <div className="flex justify-start" aria-hidden="true">
                    <div className="rounded-2xl rounded-bl-sm bg-slate-100 text-slate-500 px-4 py-2.5 text-sm">
                        <span className="inline-flex gap-1">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse" />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse animation-delay-100" />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse animation-delay-200" />
                        </span>
                    </div>
                </div>
            )}

            <div ref={bottomRef} />
        </div>
    );
}
