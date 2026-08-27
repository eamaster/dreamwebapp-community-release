import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSite } from '@/hooks/useContent';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Button } from '@/components/common/Button';
import { env } from '@/config/env';

const STATIC_LOGO_SRC = '/dreamwebapp_logo.png';

/**
 * Site Header/Navbar component
 * Responsive navigation with mobile menu, CMS content,
 * and an accessible compact customer account dropdown.
 */
export function Header() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const [logoErrored, setLogoErrored] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();
    const { data: site } = useSite();
    const { isAuthenticated, user, logout } = useCustomerAuth();

    const accountDropdownRef = useRef<HTMLDivElement>(null);
    const accountTriggerRef = useRef<HTMLButtonElement>(null);

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    const brandName = site?.brand?.name || 'DreamWebApp';
    const navigation = site?.navigation || [];
    const headerLogoUrl = site?.brand?.headerLogoUrl ? `${env.apiBaseUrl}${site.brand.headerLogoUrl}` : null;
    const logoSrc = headerLogoUrl && !logoErrored ? headerLogoUrl : STATIC_LOGO_SRC;

    // Close account dropdown on escape key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && isAccountMenuOpen) {
            setIsAccountMenuOpen(false);
            accountTriggerRef.current?.focus();
        }
    }, [isAccountMenuOpen]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                accountDropdownRef.current &&
                !accountDropdownRef.current.contains(event.target as Node)
            ) {
                setIsAccountMenuOpen(false);
            }
        }

        if (isAccountMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isAccountMenuOpen, handleKeyDown]);

    const handleSignOut = async () => {
        setIsAccountMenuOpen(false);
        setIsMobileMenuOpen(false);
        await logout();
        navigate('/');
    };

    const initials = user?.displayName
        ? user.displayName.trim().charAt(0).toUpperCase()
        : user?.email
            ? user.email.trim().charAt(0).toUpperCase()
            : 'U';

    const displayName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Account');

    return (
        <header className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 shadow-lg">
            <nav className="container-custom" aria-label="Main Navigation">
                <div className="flex items-center justify-between h-16 md:h-20">
                    {/* Logo & Brand */}
                    <Link
                        to="/"
                        className="flex items-center space-x-2 group"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <img
                            src={logoSrc}
                            alt={brandName}
                            onError={() => setLogoErrored(true)}
                            className="h-10 md:h-12 w-auto group-hover:scale-105 transition-transform duration-200"
                        />
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-1">
                        {navigation.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${isActive(item.path)
                                    ? 'text-white bg-brand-600'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>

                    {/* Desktop CTA & Account Control */}
                    <div className="hidden md:flex items-center space-x-3">
                        {isAuthenticated ? (
                            <div className="relative" ref={accountDropdownRef}>
                                <button
                                    ref={accountTriggerRef}
                                    id="customer-account-trigger"
                                    type="button"
                                    onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                                    aria-haspopup="menu"
                                    aria-expanded={isAccountMenuOpen}
                                    aria-controls="customer-account-menu"
                                    className="inline-flex items-center space-x-2.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800/90 border border-slate-700 hover:border-brand-500/50 hover:bg-slate-750 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all duration-150 shadow-sm"
                                >
                                    <span className="h-7 w-7 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center text-xs font-bold ring-1 ring-white/20">
                                        {initials}
                                    </span>
                                    <span className="max-w-[120px] truncate text-slate-100 font-medium">
                                        {displayName}
                                    </span>
                                    <svg
                                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isAccountMenuOpen ? 'rotate-180 text-brand-400' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* Dropdown Menu */}
                                {isAccountMenuOpen && (
                                    <div
                                        id="customer-account-menu"
                                        role="menu"
                                        aria-labelledby="customer-account-trigger"
                                        className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-750 shadow-2xl p-1.5 z-50 animate-scale-in text-sm"
                                    >
                                        {/* User Identity Info */}
                                        <div className="px-3 py-2.5 mb-1 rounded-xl bg-slate-800/60 border border-slate-750">
                                            <div className="flex items-center space-x-2.5">
                                                <span className="h-8 w-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">
                                                    {initials}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-white truncate">
                                                        {displayName}
                                                    </p>
                                                    <p className="text-xs text-slate-400 truncate">
                                                        {user?.email || 'No email'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-700/60">
                                                <span className="text-[11px] text-slate-400">Account status</span>
                                                {user?.emailVerified ? (
                                                    <span className="inline-flex items-center text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded-md">
                                                        <svg className="w-2.5 h-2.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Verified
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center text-[10px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.5 rounded-md">
                                                        Unverified
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Menu Links */}
                                        <Link
                                            to="/account"
                                            role="menuitem"
                                            onClick={() => setIsAccountMenuOpen(false)}
                                            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                            </svg>
                                            <span className="font-medium">Dashboard Overview</span>
                                        </Link>

                                        <Link
                                            to="/account?tab=services"
                                            role="menuitem"
                                            onClick={() => setIsAccountMenuOpen(false)}
                                            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                            </svg>
                                            <span className="font-medium">Services & Access</span>
                                        </Link>

                                        <Link
                                            to="/account?tab=payments"
                                            role="menuitem"
                                            onClick={() => setIsAccountMenuOpen(false)}
                                            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                            </svg>
                                            <span className="font-medium">Billing & Invoices</span>
                                        </Link>

                                        <Link
                                            to="/account?tab=profile"
                                            role="menuitem"
                                            onClick={() => setIsAccountMenuOpen(false)}
                                            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            <span className="font-medium">Profile Settings</span>
                                        </Link>

                                        <div className="my-1 border-t border-slate-800" />

                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={handleSignOut}
                                            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 transition-colors text-left font-medium"
                                        >
                                            <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                            <span>Sign Out</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                                >
                                    Sign in
                                </Link>
                                <Link to="/contact">
                                    <Button variant="accent" size="md">
                                        Book a Demo
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="md:hidden p-2 rounded-lg hover:bg-slate-700 transition-colors"
                        aria-label="Toggle menu"
                    >
                        <svg
                            className="w-6 h-6 text-slate-200"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            {isMobileMenuOpen ? (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            ) : (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            )}
                        </svg>
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden py-4 border-t border-slate-700 animate-slide-down bg-slate-800/50">
                        <div className="flex flex-col space-y-2">
                            {navigation.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`px-4 py-3 rounded-lg font-medium transition-colors ${isActive(item.path)
                                        ? 'text-white bg-brand-600'
                                        : 'text-slate-300 hover:text-white hover:bg-slate-700'
                                        }`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {item.label}
                                </Link>
                            ))}

                            {isAuthenticated ? (
                                <div className="pt-2 border-t border-slate-700/80 space-y-1">
                                    <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Account ({displayName})
                                    </div>
                                    <Link
                                        to="/account"
                                        className="px-4 py-2.5 rounded-lg font-medium text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        <span>Dashboard Overview</span>
                                        <span className="text-xs text-brand-400">&rarr;</span>
                                    </Link>
                                    <Link
                                        to="/account?tab=services"
                                        className="px-4 py-2.5 rounded-lg font-medium text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        <span>Services & Subscriptions</span>
                                        <span className="text-xs text-brand-400">&rarr;</span>
                                    </Link>
                                    <Link
                                        to="/account?tab=payments"
                                        className="px-4 py-2.5 rounded-lg font-medium text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        <span>Billing & Invoices</span>
                                        <span className="text-xs text-brand-400">&rarr;</span>
                                    </Link>
                                    <Link
                                        to="/account?tab=profile"
                                        className="px-4 py-2.5 rounded-lg font-medium text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        <span>Profile Settings</span>
                                        <span className="text-xs text-brand-400">&rarr;</span>
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={handleSignOut}
                                        className="w-full text-left px-4 py-2.5 rounded-lg font-medium text-rose-300 hover:bg-rose-950/40 flex items-center justify-between"
                                    >
                                        <span>Sign Out</span>
                                        <span className="text-xs text-rose-400">&times;</span>
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        className="px-4 py-3 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-700"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        Sign In / Register
                                    </Link>
                                    <div className="pt-4">
                                        <Link to="/contact" onClick={() => setIsMobileMenuOpen(false)}>
                                            <Button variant="accent" size="md" fullWidth>
                                                Book a Demo
                                            </Button>
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </nav>
        </header>
    );
}

