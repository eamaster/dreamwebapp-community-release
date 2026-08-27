import type { ReactNode } from 'react';

export function AdminSection({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <section className={`min-w-0 space-y-4 ${className}`}>{children}</section>;
}
