import { useEffect } from 'react';
import { useChatWidget } from './useChatWidget';

/**
 * Floating, unobtrusive chat launcher.
 * Fixed to the bottom-right corner with room reserved for mobile safe areas
 * so it never overlaps core page CTAs. Hidden while the panel is open.
 */
export function ChatLauncher() {
    const { isOpen, open, launcherRef, shouldFocusLauncher, notifyLauncherFocused } = useChatWidget();

    // Restore focus here once the panel closes and this button remounts —
    // it was unmounted while the panel was open, so the panel's own close()
    // handler couldn't focus it directly.
    useEffect(() => {
        if (shouldFocusLauncher) {
            launcherRef.current?.focus();
            notifyLauncherFocused();
        }
    }, [shouldFocusLauncher, launcherRef, notifyLauncherFocused]);

    if (isOpen) return null;

    return (
        <button
            ref={launcherRef}
            type="button"
            onClick={open}
            aria-label="Open AI Assistant chat"
            className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-accent-600 to-accent-700 text-white shadow-lg shadow-accent-500/40 hover:shadow-xl hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
            style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
            <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.5 0-2.91-.32-4.14-.88L3 20l1.06-3.53C3.39 15.24 3 13.68 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
            </svg>
        </button>
    );
}
