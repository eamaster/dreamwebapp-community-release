import { createContext } from 'react';
import type { ChatUiMessage } from '@/hooks/useChat';

/**
 * A single prefill request. `id` is a monotonically increasing counter, not
 * the text itself — this is what lets a visitor click the same CTA (e.g.
 * "Try the AI Assistant") twice in a row with identical text and still have
 * each click apply the prefill: consumers key off `id`, not `text`, so two
 * requests with the same text are still recognized as distinct events.
 */
export interface ChatPrefillRequest {
    id: number;
    text: string;
}

/** Which view the chat panel is showing. Lives here (not in ChatPanel local
 * state) so pages/CTAs can request the handoff view directly via `openHandoff()`
 * without a second context/provider. */
export type ChatPanelView = 'chat' | 'handoff';

export interface ChatWidgetContextValue {
    isOpen: boolean;
    view: ChatPanelView;
    /** Opens the panel without changing the input or the current view. */
    open: () => void;
    /** Opens the panel (chat view) and pre-fills (but does not send) the input. */
    openWithPrefill: (text: string) => void;
    /** Opens the panel (chat view) and immediately sends the given text. */
    openAndSend: (text: string) => void;
    /**
     * Opens the panel directly into the inline human-handoff form — no AI
     * request is made and no second click is required. Used by starter
     * prompts/CTAs explicitly marked `intent: 'handoff'`.
     */
    openHandoff: () => void;
    /** Returns from the handoff form back to the chat view. */
    closeHandoff: () => void;
    close: () => void;
    toggle: () => void;

    messages: ChatUiMessage[];
    isSending: boolean;
    validationError: string | null;
    /** Returns true if the message passed validation and was dispatched. */
    sendMessage: (text: string) => boolean;
    retry: (messageId: string) => void;
    reset: () => void;

    /**
     * The most recently issued prefill request. This is never cleared back to
     * `null` after use (see `hasPendingPrefill`) — the panel keys its composer
     * remount off `prefillRequest.id`, and clearing this value would change
     * that key and force a second, unwanted remount that wipes the just-typed
     * text while the panel is still open.
     */
    prefillRequest: ChatPrefillRequest | null;
    /** True until the current `prefillRequest` has been acknowledged via `consumePrefill()`. */
    hasPendingPrefill: boolean;
    /** Marks the current `prefillRequest` as delivered, without changing its `id`. */
    consumePrefill: () => void;

    /** Ref attached to the launcher button so focus can return to it on close. */
    launcherRef: React.RefObject<HTMLButtonElement | null>;

    /**
     * True right after the panel closes, until the (re-mounted) launcher
     * consumes it. The launcher button is unmounted while the panel is open,
     * so `launcherRef.current` is null at the moment `close()` runs — this
     * flag lets the launcher restore focus to itself once it remounts.
     */
    shouldFocusLauncher: boolean;
    notifyLauncherFocused: () => void;
}

export const ChatWidgetContext = createContext<ChatWidgetContextValue | null>(null);
