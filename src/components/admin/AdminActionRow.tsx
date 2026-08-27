import type { ReactNode } from 'react';

export function AdminActionRow({ children }: { children: ReactNode }) {
    return <div className="admin-action-row">{children}</div>;
}
