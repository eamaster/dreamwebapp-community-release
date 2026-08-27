import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useChat } from '@/hooks/useChat';
import { ChatWidgetContext, type ChatWidgetContextValue, type ChatPanelView, type ChatPrefillRequest } from './chatWidgetContext';

export function ChatProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<ChatPanelView>('chat');
    const [prefillRequest, setPrefillRequest] = useState<ChatPrefillRequest | null>(null);
    // Id of the most recently *consumed* request. Compared against
    // `prefillRequest.id` (rather than nulling `prefillRequest` itself) so
    // consumption never changes the composer's remount `key` mid-session —
    // see the comment on `hasPendingPrefill` in chatWidgetContext.ts.
    const [consumedPrefillId, setConsumedPrefillId] = useState<number | null>(null);
    const [shouldFocusLauncher, setShouldFocusLauncher] = useState(false);
    const launcherRef = useRef<HTMLButtonElement>(null);
    // Monotonic counter — guarantees every openWithPrefill() call produces a
    // distinct request even when the text is identical to the previous one.
    const prefillIdRef = useRef(0);
    const chat = useChat();

    const open = useCallback(() => setIsOpen(true), []);

    const openWithPrefill = useCallback((text: string) => {
        prefillIdRef.current += 1;
        setPrefillRequest({ id: prefillIdRef.current, text });
        setView('chat');
        setIsOpen(true);
    }, []);

    const openAndSend = useCallback(
        (text: string) => {
            setView('chat');
            setIsOpen(true);
            chat.sendMessage(text);
        },
        [chat]
    );

    const openHandoff = useCallback(() => {
        setView('handoff');
        setIsOpen(true);
    }, []);

    const closeHandoff = useCallback(() => setView('chat'), []);

    const close = useCallback(() => {
        setIsOpen(false);
        // The launcher button is unmounted while the panel is open, so we
        // can't focus it synchronously here — flag it so the launcher can
        // restore focus to itself once it remounts (see notifyLauncherFocused).
        setShouldFocusLauncher(true);
    }, []);

    const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
    const hasPendingPrefill = prefillRequest !== null && prefillRequest.id !== consumedPrefillId;
    const consumePrefill = useCallback(() => {
        setConsumedPrefillId(prefillRequest?.id ?? null);
    }, [prefillRequest]);
    const notifyLauncherFocused = useCallback(() => setShouldFocusLauncher(false), []);

    const value = useMemo<ChatWidgetContextValue>(
        () => ({
            isOpen,
            view,
            open,
            openWithPrefill,
            openAndSend,
            openHandoff,
            closeHandoff,
            close,
            toggle,
            messages: chat.messages,
            isSending: chat.isSending,
            validationError: chat.validationError,
            sendMessage: chat.sendMessage,
            retry: chat.retry,
            reset: chat.reset,
            prefillRequest,
            hasPendingPrefill,
            consumePrefill,
            launcherRef,
            shouldFocusLauncher,
            notifyLauncherFocused,
        }),
        [
            isOpen,
            view,
            open,
            openWithPrefill,
            openAndSend,
            openHandoff,
            closeHandoff,
            close,
            toggle,
            chat,
            prefillRequest,
            hasPendingPrefill,
            consumePrefill,
            shouldFocusLauncher,
            notifyLauncherFocused,
        ]
    );

    return <ChatWidgetContext.Provider value={value}>{children}</ChatWidgetContext.Provider>;
}
