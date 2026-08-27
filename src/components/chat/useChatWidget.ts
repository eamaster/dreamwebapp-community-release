import { useContext } from 'react';
import { ChatWidgetContext, type ChatWidgetContextValue } from './chatWidgetContext';

export function useChatWidget(): ChatWidgetContextValue {
    const ctx = useContext(ChatWidgetContext);
    if (!ctx) {
        throw new Error('useChatWidget must be used within a ChatProvider');
    }
    return ctx;
}

/**
 * Non-throwing variant for components that render regardless of whether the
 * chat widget is enabled (e.g. homepage CTAs). Returns null when there is no
 * ChatProvider in the tree instead of throwing, so pages stay functional with
 * the widget disabled (VITE_ENABLE_CHAT_WIDGET=false).
 */
export function useOptionalChatWidget(): ChatWidgetContextValue | null {
    return useContext(ChatWidgetContext);
}
