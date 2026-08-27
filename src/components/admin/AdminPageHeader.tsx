import type { ReactNode } from 'react';
import { AdminActionRow } from './AdminActionRow';

export interface AdminPageHeaderProps {
    title: string;
    description?: string;
    actions?: ReactNode;
}

/** Page-level heading on the dark admin shell (not inside a white card). */
export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
    return (
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
                <h1 className="text-xl font-bold text-white admin-break sm:text-2xl">{title}</h1>
                {description && (
                    <p className="mt-1 text-sm text-slate-300 admin-break">{description}</p>
                )}
            </div>
            {actions ? (
                <div className="w-full shrink-0 sm:w-auto">
                    <AdminActionRow>{actions}</AdminActionRow>
                </div>
            ) : null}
        </div>
    );
}
