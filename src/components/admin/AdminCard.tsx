import type { ReactNode } from 'react';

export interface AdminCardProps {
    children: ReactNode;
    className?: string;
    as?: 'section' | 'div' | 'article';
}

/**
 * White content surface for the dark admin shell. Explicitly avoids the
 * public `Card` component so `bg-white` cannot fight light-on-dark text.
 */
export function AdminCard({ children, className = '', as: Tag = 'section' }: AdminCardProps) {
    return (
        <Tag className={`min-w-0 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-md sm:p-6 ${className}`}>
            {children}
        </Tag>
    );
}
