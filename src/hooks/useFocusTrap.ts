import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
    );
}

/**
 * Small local focus trap for the chat dialog — keeps Tab/Shift+Tab cycling
 * within the container while `active` is true. Deliberately minimal (no
 * dependency) since this is used by exactly one widget; re-queries focusable
 * elements on every Tab press so it stays correct when the panel switches
 * between the conversation view and the handoff form.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean): void {
    useEffect(() => {
        if (!active) return;
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            const focusable = getFocusable(container);
            if (focusable.length === 0) return;

            const first = focusable[0]!;
            const last = focusable[focusable.length - 1]!;
            const activeElement = document.activeElement as HTMLElement | null;

            if (e.shiftKey) {
                if (activeElement === first || !container.contains(activeElement)) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (activeElement === last || !container.contains(activeElement)) {
                e.preventDefault();
                first.focus();
            }
        };

        container.addEventListener('keydown', handleKeyDown);
        return () => container.removeEventListener('keydown', handleKeyDown);
    }, [containerRef, active]);
}
