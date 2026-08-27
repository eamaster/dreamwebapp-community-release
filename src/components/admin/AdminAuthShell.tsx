import type { ReactNode } from 'react';
import { AdminCard } from './AdminCard';

export function AdminAuthShell({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <div className="admin-app relative flex min-h-svh w-full min-w-0 flex-col justify-center overflow-x-hidden bg-slate-950 px-4 py-10 sm:px-6">
            <div className="pointer-events-none absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
            <div className="relative z-10 mx-auto w-full max-w-md">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl admin-break">
                        {title}
                    </h1>
                    {description && (
                        <p className="mt-2 text-sm text-slate-300 admin-break">{description}</p>
                    )}
                </div>
                <AdminCard className="shadow-2xl">{children}</AdminCard>
            </div>
        </div>
    );
}
