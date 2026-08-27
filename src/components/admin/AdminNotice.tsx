import type { ReactNode } from 'react';

export type AdminNoticeVariant = 'info' | 'success' | 'warning' | 'error' | 'loading';

export interface AdminNoticeProps {
    variant: AdminNoticeVariant;
    title: string;
    children?: ReactNode;
    action?: ReactNode;
}

const VARIANT_CLASS: Record<AdminNoticeVariant, string> = {
    info: 'border-slate-400 bg-slate-100 text-slate-900',
    success: 'border-emerald-800 bg-emerald-50 text-emerald-950',
    warning: 'border-amber-800 bg-amber-50 text-amber-950',
    error: 'border-red-800 bg-red-50 text-red-950',
    loading: 'border-slate-400 bg-slate-100 text-slate-900',
};

/**
 * Compact, high-contrast status/alert. Title is always visible text — never
 * color or emoji alone.
 */
export function AdminNotice({ variant, title, children, action }: AdminNoticeProps) {
    const role = variant === 'error' ? 'alert' : 'status';

    return (
        <div
            role={role}
            className={`rounded-lg border px-3 py-3 sm:px-4 ${VARIANT_CLASS[variant]}`}
        >
            <p className="font-semibold text-sm sm:text-base admin-break">{title}</p>
            {children && (
                <div className="mt-1.5 text-sm leading-relaxed admin-break">{children}</div>
            )}
            {action && <div className="mt-3 admin-action-row">{action}</div>}
        </div>
    );
}
