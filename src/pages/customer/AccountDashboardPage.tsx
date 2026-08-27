import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import {
    customerGetServices,
    customerGetServiceDetail,
    customerGetPayments,
    customerGetPaymentDetail,
    customerUpdateProfile,
    customerResendEmailVerification,
    customerGetDeletionEligibility,
    customerDeleteAccount,
    type CustomerServiceDto,
    type CustomerPaymentOrderDto,
    type CustomerServiceDetailResponse,
    type CustomerPaymentDetailResponse,
    type CustomerDeletionEligibility,
    isApiError,
} from '@/lib/api-client';

type Tab = 'services' | 'payments' | 'profile';

export function AccountDashboardPage() {
    const { user, isAuthenticated, isLoading: authLoading, logout, refreshUser } = useCustomerAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const tabParam = searchParams.get('tab') as Tab | null;
    const activeTab: Tab = tabParam && ['services', 'payments', 'profile'].includes(tabParam) ? tabParam : 'services';

    const handleSelectTab = (tab: Tab) => {
        setSearchParams({ tab });
    };

    // Services State
    const [services, setServices] = useState<CustomerServiceDto[]>([]);
    const [servicesTotal, setServicesTotal] = useState(0);
    const [servicesLoading, setServicesLoading] = useState(false);
    const [selectedService, setSelectedService] = useState<CustomerServiceDetailResponse | null>(null);

    // Payments State
    const [payments, setPayments] = useState<CustomerPaymentOrderDto[]>([]);
    const [paymentsTotal, setPaymentsTotal] = useState(0);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<CustomerPaymentDetailResponse | null>(null);

    // Profile State
    const [displayName, setDisplayName] = useState('');
    const [profileUpdating, setProfileUpdating] = useState(false);
    const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
    const [profileError, setProfileError] = useState<string | null>(null);

    // Email Verification Resend State
    const [resendingVerification, setResendingVerification] = useState(false);
    const [resendSuccess, setResendSuccess] = useState<string | null>(null);
    const [resendError, setResendError] = useState<string | null>(null);
    const [resendCooldown, setResendCooldown] = useState(0);

    // Account Deletion State
    const [deletionEligibility, setDeletionEligibility] = useState<CustomerDeletionEligibility | null>(null);
    const [eligibilityLoading, setEligibilityLoading] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login?returnTo=/account', { replace: true });
        }
    }, [authLoading, isAuthenticated, navigate]);

    useEffect(() => {
        if (user) {
            setDisplayName(user.displayName || '');
        }
    }, [user]);

    // Load Services
    const loadServices = useCallback(async () => {
        setServicesLoading(true);
        try {
            const res = await customerGetServices({ page: 1, pageSize: 50 });
            setServices(res.items);
            setServicesTotal(res.total);
        } catch (err) {
            console.error('Failed to load customer services:', err);
        } finally {
            setServicesLoading(false);
        }
    }, []);

    // Load Payments
    const loadPayments = useCallback(async () => {
        setPaymentsLoading(true);
        try {
            const res = await customerGetPayments({ page: 1, pageSize: 50 });
            setPayments(res.items);
            setPaymentsTotal(res.total);
        } catch (err) {
            console.error('Failed to load customer payments:', err);
        } finally {
            setPaymentsLoading(false);
        }
    }, []);

    // Load Deletion Eligibility
    const loadDeletionEligibility = useCallback(async () => {
        setEligibilityLoading(true);
        try {
            const res = await customerGetDeletionEligibility();
            setDeletionEligibility(res);
        } catch (err) {
            console.error('Failed to load deletion eligibility:', err);
        } finally {
            setEligibilityLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            if (activeTab === 'services') loadServices();
            if (activeTab === 'payments') loadPayments();
            if (activeTab === 'profile') loadDeletionEligibility();
        }
    }, [isAuthenticated, activeTab, loadServices, loadPayments, loadDeletionEligibility]);

    // Resend cooldown timer
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown((c) => Math.max(0, c - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const handleResendVerification = async () => {
        if (resendingVerification || resendCooldown > 0) return;
        setResendingVerification(true);
        setResendSuccess(null);
        setResendError(null);

        try {
            const res = await customerResendEmailVerification();
            setResendSuccess(res.message || 'Verification email sent! Please check your inbox.');
            setResendCooldown(60); // 60-second cooldown
        } catch (err: unknown) {
            const msg = isApiError(err) ? err.message : 'Failed to send verification email. Please try again.';
            setResendError(msg);
        } finally {
            setResendingVerification(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deletingAccount) return;
        setDeletingAccount(true);
        setDeleteError(null);

        try {
            await customerDeleteAccount();
            await logout();
            navigate('/', { replace: true });
        } catch (err: unknown) {
            if (isApiError(err) && err.status === 401) {
                setDeleteError('Your session has expired. Please sign in again.');
                setTimeout(() => navigate('/login?returnTo=/account', { replace: true }), 1500);
            } else {
                const msg = isApiError(err) ? err.message : 'Failed to delete account. Please try again.';
                setDeleteError(msg);
            }
            setDeletingAccount(false);
        }
    };

    const handleViewService = async (serviceId: string) => {
        try {
            const detail = await customerGetServiceDetail(serviceId);
            setSelectedService(detail);
        } catch (err) {
            console.error('Failed to load service detail:', err);
        }
    };

    const handleViewPayment = async (orderId: string) => {
        try {
            const detail = await customerGetPaymentDetail(orderId);
            setSelectedPayment(detail);
        } catch (err) {
            console.error('Failed to load payment detail:', err);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileUpdating(true);
        setProfileSuccess(null);
        setProfileError(null);

        try {
            await customerUpdateProfile({ displayName: displayName.trim() || undefined });
            await refreshUser();
            setProfileSuccess('Profile updated successfully.');
        } catch (err) {
            if (isApiError(err)) {
                setProfileError(err.message);
            } else if (err instanceof Error) {
                setProfileError(err.message);
            } else {
                setProfileError('Failed to update profile.');
            }
        } finally {
            setProfileUpdating(false);
        }
    };

    const handleSignOut = async () => {
        await logout();
        navigate('/', { replace: true });
    };

    if (authLoading || !user) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center bg-slate-950">
                <div className="flex items-center space-x-3 text-brand-400">
                    <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-lg font-medium text-slate-300">Loading your account...</span>
                </div>
            </div>
        );
    }

    const renderServiceStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">Active</span>;
            case 'provisioning':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/80 border border-blue-700/60 text-blue-300">Provisioning</span>;
            case 'completed':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300">Completed</span>;
            case 'suspended':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 border border-amber-700/60 text-amber-300">Suspended</span>;
            case 'cancelled':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/80 border border-red-700/60 text-red-300">Cancelled</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">{status}</span>;
        }
    };

    const renderPaymentStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">Paid</span>;
            case 'waiting':
            case 'pending':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 border border-amber-700/60 text-amber-300">Waiting Payment</span>;
            case 'confirming':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/80 border border-blue-700/60 text-blue-300">Confirming</span>;
            case 'partially_paid':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-950/80 border border-orange-700/60 text-orange-300">Partially Paid</span>;
            case 'expired':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-400">Expired</span>;
            case 'failed':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/80 border border-red-700/60 text-red-300">Failed</span>;
            case 'refunded':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-950/80 border border-purple-700/60 text-purple-300">Refunded</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">{status}</span>;
        }
    };

    return (
        <div className="min-h-[85vh] bg-slate-950 text-slate-100 py-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Unverified Email Warning Banner */}
                {user && !user.emailVerified && user.email && (
                    <div className="mb-6 rounded-2xl border border-amber-800/80 bg-amber-950/40 p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start space-x-3">
                            <div className="p-2 rounded-xl bg-amber-900/60 text-amber-300 shrink-0">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-amber-200">Email Address Unverified</h3>
                                <p className="text-xs text-amber-300/80 mt-0.5">
                                    Please verify your email address (<span className="font-mono">{user.email}</span>) to secure your account.
                                </p>
                                {resendSuccess && (
                                    <p className="text-xs font-semibold text-emerald-300 mt-2">{resendSuccess}</p>
                                )}
                                {resendError && (
                                    <p className="text-xs font-semibold text-red-300 mt-2">{resendError}</p>
                                )}
                            </div>
                        </div>

                        <div className="shrink-0">
                            <button
                                type="button"
                                onClick={handleResendVerification}
                                disabled={resendingVerification || resendCooldown > 0}
                                className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-all duration-200 disabled:opacity-50"
                            >
                                {resendingVerification
                                    ? 'Sending...'
                                    : resendCooldown > 0
                                    ? `Resend in ${resendCooldown}s`
                                    : 'Resend Verification Email'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Header Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center space-x-4">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                            {user.displayName ? user.displayName[0]?.toUpperCase() : (user.email ? user.email[0]?.toUpperCase() : 'U')}
                        </div>
                        <div>
                            <div className="flex items-center space-x-2">
                                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                                    {user.displayName || 'Customer Dashboard'}
                                </h1>
                                {user.emailVerified ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-950 border border-emerald-800 text-emerald-300">
                                        Verified
                                    </span>
                                ) : user.email ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-950 border border-amber-800 text-amber-300">
                                        Unverified
                                    </span>
                                ) : null}
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                                {user.email || 'OAuth Signed-in Account'} &bull; Member since {new Date(user.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        <Link
                            to="/pricing"
                            className="inline-flex items-center px-4 py-2 border border-brand-500/40 rounded-xl text-sm font-semibold text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 transition-all duration-200"
                        >
                            Explore Plans
                        </Link>
                        <button
                            type="button"
                            onClick={handleSignOut}
                            className="inline-flex items-center px-4 py-2 border border-slate-700 rounded-xl text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-all duration-200"
                        >
                            Sign out
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800 space-x-8 mb-8 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => handleSelectTab('services')}
                        className={`pb-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === 'services'
                                ? 'border-brand-500 text-brand-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Active Services ({servicesTotal})
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSelectTab('payments')}
                        className={`pb-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === 'payments'
                                ? 'border-brand-500 text-brand-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Payment Orders ({paymentsTotal})
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSelectTab('profile')}
                        className={`pb-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === 'profile'
                                ? 'border-brand-500 text-brand-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Profile Settings
                    </button>
                </div>

                {/* Tab: Services */}
                {activeTab === 'services' && (
                    <div>
                        {servicesLoading ? (
                            <div className="text-center py-16 text-slate-400">
                                <svg className="animate-spin h-8 w-8 mx-auto text-brand-500 mb-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Loading your services...
                            </div>
                        ) : services.length === 0 ? (
                            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
                                <div className="mx-auto h-16 w-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-4">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-white">No active services yet</h3>
                                <p className="text-slate-400 mt-2 max-w-md mx-auto text-sm">
                                    When you purchase an automation package or AI solution, your active entitlements will appear right here.
                                </p>
                                <div className="mt-6">
                                    <Link
                                        to="/pricing"
                                        className="inline-flex items-center px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400 shadow-md transition-all duration-200"
                                    >
                                        View Automation Plans
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {services.map((svc) => (
                                    <div
                                        key={svc.id}
                                        className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                {renderServiceStatusBadge(svc.status)}
                                                <span className="text-xs text-slate-500 font-mono">
                                                    {new Date(svc.startedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2">{svc.serviceName}</h3>
                                            <p className="text-xs text-slate-400 mb-4 font-mono truncate">
                                                Order: {svc.orderId}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleViewService(svc.id)}
                                            className="w-full mt-4 py-2 px-3 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                                        >
                                            View Details &rarr;
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: Payments */}
                {activeTab === 'payments' && (
                    <div>
                        {paymentsLoading ? (
                            <div className="text-center py-16 text-slate-400">
                                <svg className="animate-spin h-8 w-8 mx-auto text-brand-500 mb-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Loading your payments...
                            </div>
                        ) : payments.length === 0 ? (
                            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
                                <div className="mx-auto h-16 w-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-4">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-white">No payment history found</h3>
                                <p className="text-slate-400 mt-2 max-w-md mx-auto text-sm">
                                    Orders placed while logged into this account will be recorded here automatically with full transaction details.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-850/80 border-b border-slate-800 text-xs uppercase text-slate-400">
                                            <tr>
                                                <th className="px-6 py-4">Order ID</th>
                                                <th className="px-6 py-4">Plan</th>
                                                <th className="px-6 py-4">Amount</th>
                                                <th className="px-6 py-4">Crypto</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4">Date</th>
                                                <th className="px-6 py-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800 text-slate-200">
                                            {payments.map((ord) => (
                                                <tr key={ord.orderId} className="hover:bg-slate-800/40 transition-colors">
                                                    <td className="px-6 py-4 font-mono text-xs text-brand-400">
                                                        {ord.orderId}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-white">
                                                        {ord.planName}
                                                    </td>
                                                    <td className="px-6 py-4 font-semibold text-emerald-400">
                                                        ${ord.priceAmountDecimal} {ord.priceCurrency.toUpperCase()}
                                                    </td>
                                                    <td className="px-6 py-4 uppercase font-mono text-xs text-slate-300">
                                                        {ord.payCurrency}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {renderPaymentStatusBadge(ord.internalStatus)}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-slate-400">
                                                        {new Date(ord.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleViewPayment(ord.orderId)}
                                                            className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
                                                        >
                                                            View &rarr;
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: Profile */}
                {activeTab === 'profile' && (
                    <div className="max-w-2xl bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-lg">
                        <h2 className="text-xl font-bold text-white mb-6">Profile Settings</h2>

                        {profileSuccess && (
                            <div className="mb-6 rounded-lg bg-emerald-950/60 border border-emerald-800/80 p-4 text-sm text-emerald-200">
                                {profileSuccess}
                            </div>
                        )}

                        {profileError && (
                            <div className="mb-6 rounded-lg bg-red-950/60 border border-red-800/80 p-4 text-sm text-red-200">
                                {profileError}
                            </div>
                        )}

                        <form onSubmit={handleUpdateProfile} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300">Email Address</label>
                                <input
                                    type="text"
                                    disabled
                                    value={user.email || 'No email attached (OAuth profile)'}
                                    className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/40 border border-slate-700/60 rounded-xl text-slate-400 text-sm cursor-not-allowed"
                                />
                                <p className="text-xs text-slate-500 mt-1">Email cannot be changed directly.</p>
                            </div>

                            <div>
                                <label htmlFor="profileDisplayName" className="block text-sm font-medium text-slate-300">
                                    Display Name
                                </label>
                                <input
                                    id="profileDisplayName"
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/70 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
                                    placeholder="Your Name"
                                />
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={profileUpdating}
                                    className="px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm shadow-md transition-all duration-200 disabled:opacity-50"
                                >
                                    {profileUpdating ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>

                        {/* Danger Zone: Account Deletion */}
                        <div className="mt-12 pt-8 border-t border-slate-800">
                            <h3 className="text-base font-bold text-red-400 mb-2">Danger Zone</h3>
                            <p className="text-xs text-slate-400 mb-6">
                                Once you delete your account, all active sessions and credentials will be permanently revoked. 
                                Account deletion is only permitted when you have no active services and no purchased payment history.
                            </p>

                            {eligibilityLoading ? (
                                <div className="text-xs text-slate-400">Checking deletion eligibility...</div>
                            ) : deletionEligibility && !deletionEligibility.eligible ? (
                                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-950 border border-red-800 text-red-300">
                                            Deletion Blocked
                                        </span>
                                        <span className="text-xs font-medium text-slate-300">
                                            {deletionEligibility.details}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        Active services or completed payment records must be preserved for audit and delivery purposes.
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDeleteConfirmText('');
                                            setDeleteError(null);
                                            setDeleteModalOpen(true);
                                        }}
                                        className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-950/80 hover:bg-red-900/80 text-red-300 border border-red-800 transition-colors shadow-sm"
                                    >
                                        Delete My Account
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Account Deletion Confirmation Modal */}
                {deleteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-red-900/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
                            <div className="flex items-center space-x-3 text-red-400 border-b border-slate-800 pb-4">
                                <div className="p-2 rounded-xl bg-red-950 border border-red-800">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Delete Account</h3>
                                    <p className="text-xs text-slate-400">This action is permanent and irreversible.</p>
                                </div>
                            </div>

                            {deleteError && (
                                <div className="rounded-lg bg-red-950/80 border border-red-800 p-3 text-xs text-red-200">
                                    {deleteError}
                                </div>
                            )}

                            <p className="text-xs text-slate-300 leading-relaxed">
                                Are you sure you want to delete your account? All sessions, linked authentication identities, and profile details will be permanently removed.
                            </p>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                                    Type <span className="text-red-400 font-mono">DELETE</span> to confirm:
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder="DELETE"
                                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                                />
                            </div>

                            <div className="flex items-center justify-end space-x-3 pt-2">
                                <button
                                    type="button"
                                    disabled={deletingAccount}
                                    onClick={() => setDeleteModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deletingAccount}
                                    onClick={handleDeleteAccount}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                                >
                                    {deletingAccount ? 'Deleting Account...' : 'Permanently Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Service Detail Modal */}
                {selectedService && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                <h3 className="text-lg font-bold text-white">Service Details</h3>
                                <button
                                    type="button"
                                    onClick={() => setSelectedService(null)}
                                    className="text-slate-400 hover:text-white text-xl leading-none"
                                >
                                    &times;
                                </button>
                            </div>

                            <div className="space-y-4 text-sm">
                                <div>
                                    <span className="text-slate-400 block text-xs">Service Name</span>
                                    <span className="text-white font-semibold text-base">{selectedService.service.serviceName}</span>
                                </div>
                                <div className="flex justify-between py-2 border-y border-slate-800/60">
                                    <div>
                                        <span className="text-slate-400 block text-xs">Status</span>
                                        {renderServiceStatusBadge(selectedService.service.status)}
                                    </div>
                                    <div className="text-right">
                                        <span className="text-slate-400 block text-xs">Started Date</span>
                                        <span className="text-slate-200">{new Date(selectedService.service.startedAt).toLocaleString()}</span>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-xs">Order Reference</span>
                                    <span className="text-brand-400 font-mono text-xs break-all">{selectedService.service.orderId}</span>
                                </div>
                                {selectedService.order && (
                                    <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-800 space-y-2">
                                        <span className="text-xs text-slate-400 font-semibold block">Associated Payment</span>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-400">Amount Paid:</span>
                                            <span className="text-emerald-400 font-semibold">${selectedService.order.priceAmountDecimal} {selectedService.order.priceCurrency.toUpperCase()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-400">Crypto Currency:</span>
                                            <span className="text-slate-200 uppercase font-mono">{selectedService.order.payCurrency}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedService(null)}
                                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Detail Modal */}
                {selectedPayment && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                <h3 className="text-lg font-bold text-white">Payment Order Details</h3>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPayment(null)}
                                    className="text-slate-400 hover:text-white text-xl leading-none"
                                >
                                    &times;
                                </button>
                            </div>

                            <div className="space-y-4 text-sm">
                                <div>
                                    <span className="text-slate-400 block text-xs">Order ID</span>
                                    <span className="text-brand-400 font-mono text-sm break-all">{selectedPayment.order.orderId}</span>
                                </div>
                                <div className="flex justify-between py-2 border-y border-slate-800/60">
                                    <div>
                                        <span className="text-slate-400 block text-xs">Plan</span>
                                        <span className="text-white font-semibold">{selectedPayment.order.planName}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-slate-400 block text-xs">Status</span>
                                        {renderPaymentStatusBadge(selectedPayment.order.internalStatus)}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-slate-400 block text-xs">Target Price</span>
                                        <span className="text-emerald-400 font-semibold">${selectedPayment.order.priceAmountDecimal} {selectedPayment.order.priceCurrency.toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-xs">Pay Currency</span>
                                        <span className="text-slate-200 uppercase font-mono">{selectedPayment.order.payCurrency}</span>
                                    </div>
                                </div>
                                {selectedPayment.order.expectedPayAmountDecimal && (
                                    <div>
                                        <span className="text-slate-400 block text-xs">Crypto Amount</span>
                                        <span className="text-slate-200 font-mono">{selectedPayment.order.expectedPayAmountDecimal} {selectedPayment.order.payCurrency.toUpperCase()}</span>
                                    </div>
                                )}
                                <div>
                                    <span className="text-slate-400 block text-xs">Created At</span>
                                    <span className="text-slate-300">{new Date(selectedPayment.order.createdAt).toLocaleString()}</span>
                                </div>
                                {selectedPayment.service && (
                                    <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-800 space-y-1">
                                        <span className="text-xs text-slate-400 font-semibold block">Activated Service</span>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-white font-medium">{selectedPayment.service.serviceName}</span>
                                            {renderServiceStatusBadge(selectedPayment.service.status)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedPayment(null)}
                                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
