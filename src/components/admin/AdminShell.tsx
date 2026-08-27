import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface AdminNavItem {
    id: string;
    label: string;
    icon: ReactNode;
    count?: number;
    badge?: string;
}

import { AdminIcon } from './AdminIcons';

export interface AdminShellProps {
    activeTab: string;
    navItems: AdminNavItem[];
    onSelectTab: (id: string) => void;
    navOpen: boolean;
    onNavOpenChange: (open: boolean) => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    onSignOut: () => void;
    statusMessage: { type: 'success' | 'error'; text: string } | null;
    children: ReactNode;
}

export function AdminShell({
    activeTab,
    navItems,
    onSelectTab,
    navOpen,
    onNavOpenChange,
    onRefresh,
    isRefreshing,
    onSignOut,
    statusMessage,
    children,
}: AdminShellProps) {
    const drawerId = useId();
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const drawerRef = useRef<HTMLDivElement>(null);

    useFocusTrap(drawerRef, navOpen);

    useEffect(() => {
        if (!navOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onNavOpenChange(false);
        };
        document.addEventListener('keydown', handleKey);
        const menuButton = menuButtonRef.current;
        drawerRef.current?.querySelector<HTMLElement>('button, a')?.focus();
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKey);
            menuButton?.focus();
        };
    }, [navOpen, onNavOpenChange]);

    const selectTab = (id: string) => {
        onSelectTab(id);
        onNavOpenChange(false);
    };

    return (
        <div className="admin-app flex min-h-svh w-full min-w-0 flex-col overflow-x-hidden bg-slate-950 text-slate-100">
            <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
                <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-3 py-3 sm:px-4 lg:px-8">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <button
                            ref={menuButtonRef}
                            type="button"
                            className="admin-touch admin-motion inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-brand-400 lg:hidden"
                            aria-expanded={navOpen}
                            aria-controls={drawerId}
                            onClick={() => onNavOpenChange(!navOpen)}
                        >
                            <span className="sr-only">{navOpen ? 'Close navigation menu' : 'Open navigation menu'}</span>
                            <span aria-hidden="true">{navOpen ? '✕' : '☰'}</span>
                        </button>
                        <div className="flex min-w-0 items-center gap-2">
                            <div
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-accent-600 font-bold text-white"
                                aria-hidden="true"
                            >
                                ⚡
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-base font-bold text-white sm:text-lg">DreamWebApp</p>
                                <p className="text-xs font-medium text-brand-200">CMS Admin</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-2 min-[480px]:w-auto min-[480px]:justify-end">
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            className="admin-touch inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-600 px-3 text-sm font-medium text-slate-100 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 min-[480px]:flex-none"
                        >
                            <AdminIcon name="refresh" className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            <span>{isRefreshing ? 'Refreshing' : 'Refresh'}</span>
                        </button>
                        <Link
                            to="/"
                            target="_blank"
                            rel="noreferrer"
                            className="admin-touch inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-600 px-3 text-sm font-medium text-slate-100 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-brand-400 min-[480px]:flex-none"
                        >
                            <span>Live site</span>
                            <AdminIcon name="external" className="w-3.5 h-3.5" />
                        </Link>
                        <button
                            type="button"
                            onClick={onSignOut}
                            className="admin-touch inline-flex flex-1 items-center justify-center rounded-lg border border-red-400 px-3 text-sm font-semibold text-red-200 hover:bg-red-950 focus-visible:ring-2 focus-visible:ring-red-300 min-[480px]:flex-none"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </header>

            {statusMessage && (
                <div
                    role="status"
                    className={`fixed bottom-4 left-3 right-3 z-50 rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl sm:left-auto sm:right-5 sm:max-w-sm ${
                        statusMessage.type === 'success'
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                            : 'border-red-700 bg-red-50 text-red-950'
                    }`}
                >
                    {statusMessage.text}
                </div>
            )}

            <div className="mx-auto flex w-full max-w-7xl flex-1 min-w-0 gap-6 px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
                <nav
                    aria-label="Admin sections"
                    className="hidden w-56 shrink-0 flex-col gap-1 xl:w-60 lg:flex"
                >
                    <NavList items={navItems} activeTab={activeTab} onSelect={selectTab} />
                </nav>

                {navOpen && (
                    <div className="fixed inset-0 z-40 lg:hidden">
                        <button
                            type="button"
                            className="absolute inset-0 bg-slate-950/70"
                            aria-label="Close navigation menu"
                            onClick={() => onNavOpenChange(false)}
                        />
                        <div
                            ref={drawerRef}
                            id={drawerId}
                            role="dialog"
                            aria-modal="true"
                            aria-label="Admin navigation"
                            className="admin-motion absolute inset-y-0 left-0 flex w-[min(18rem,calc(100%-2.5rem))] flex-col overflow-y-auto border-r border-slate-800 bg-slate-900 p-3 shadow-2xl"
                        >
                            <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Navigate
                            </p>
                            <NavList items={navItems} activeTab={activeTab} onSelect={selectTab} />
                        </div>
                    </div>
                )}

                <main className="min-w-0 flex-1">{children}</main>
            </div>
        </div>
    );
}

function NavList({
    items,
    activeTab,
    onSelect,
}: {
    items: AdminNavItem[];
    activeTab: string;
    onSelect: (id: string) => void;
}) {
    return (
        <ul className="flex flex-col gap-1">
            {items.map((item) => {
                const active = activeTab === item.id;
                return (
                    <li key={item.id}>
                        <button
                            type="button"
                            onClick={() => onSelect(item.id)}
                            aria-current={active ? 'page' : undefined}
                            className={`admin-touch flex w-full min-w-0 items-start justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand-300 ${
                                active
                                    ? 'bg-brand-600 font-semibold text-white shadow-md ring-1 ring-brand-300'
                                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                            }`}
                        >
                            <span className="flex min-w-0 items-start gap-2">
                                <span aria-hidden="true" className="shrink-0 pt-0.5">
                                    {item.icon}
                                </span>
                                <span className="admin-break">{item.label}</span>
                            </span>
                            {item.badge ? (
                                <span className="shrink-0 rounded-full bg-accent-600 px-2 py-0.5 text-xs font-bold text-white">
                                    {item.badge}
                                </span>
                            ) : item.count !== undefined ? (
                                <span className="shrink-0 text-xs font-normal text-slate-400">{item.count}</span>
                            ) : null}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
