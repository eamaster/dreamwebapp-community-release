import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdminCard } from './AdminCard';
import { AdminPageHeader } from './AdminPageHeader';
import { AdminSection } from './AdminSection';
import { Button } from '../common/Button';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import {
    adminGetCustomers,
    adminGetCustomerDetail,
    adminSetCustomerDisabled,
    isApiError,
    type AdminCustomerDto,
    type AdminCustomerDetailDto,
    type AdminCustomersQuery,
} from '@/lib/api-client';

function formatDate(iso?: string | null): string {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

export function CustomersPanel() {
    const [customers, setCustomers] = useState<AdminCustomerDto[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Detail Modal State
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [customerDetail, setCustomerDetail] = useState<AdminCustomerDetailDto | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);

    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef, Boolean(selectedCustomerId));

    const loadCustomers = useCallback(async (queryOverrides?: Partial<AdminCustomersQuery>) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await adminGetCustomers({
                page,
                pageSize,
                search: search.trim() || undefined,
                status: statusFilter,
                ...queryOverrides,
            });
            setCustomers(res.items);
            setTotal(res.total);
            setTotalPages(res.totalPages);
        } catch (err) {
            if (isApiError(err)) {
                setError(err.message);
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Failed to load customers');
            }
        } finally {
            setIsLoading(false);
        }
    }, [page, pageSize, search, statusFilter]);

    useEffect(() => {
        loadCustomers();
    }, [loadCustomers]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        loadCustomers({ page: 1, search: search.trim() || undefined });
    };

    const handleOpenDetail = async (customerId: string) => {
        setSelectedCustomerId(customerId);
        setDetailLoading(true);
        setActionError(null);
        setActionSuccess(null);
        try {
            const detail = await adminGetCustomerDetail(customerId);
            setCustomerDetail(detail);
        } catch (err) {
            setActionError(isApiError(err) ? err.message : 'Failed to load customer details');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleCloseDetail = () => {
        setSelectedCustomerId(null);
        setCustomerDetail(null);
        setActionError(null);
        setActionSuccess(null);
    };

    const handleToggleDisabled = async (disable: boolean) => {
        if (!customerDetail) return;
        const confirmMsg = disable
            ? `Are you sure you want to disable ${customerDetail.user.email || customerDetail.user.id}? This will immediately revoke all active sessions.`
            : `Re-enable account for ${customerDetail.user.email || customerDetail.user.id}?`;
        if (!window.confirm(confirmMsg)) return;

        setActionLoading(true);
        setActionError(null);
        setActionSuccess(null);

        try {
            await adminSetCustomerDisabled(customerDetail.user.id, disable);
            setActionSuccess(disable ? 'Customer account disabled and sessions revoked.' : 'Customer account re-enabled.');
            // Reload detail & list
            const updatedDetail = await adminGetCustomerDetail(customerDetail.user.id);
            setCustomerDetail(updatedDetail);
            loadCustomers();
        } catch (err) {
            setActionError(isApiError(err) ? err.message : 'Failed to update account status');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Customer Management"
                description="Inspect customer accounts, identities, session status, purchased services, and payment order history."
            />

            {error && (
                <div className="rounded-xl border border-red-800 bg-red-950/60 p-4 text-sm text-red-200">
                    {error}
                </div>
            )}

            {/* Filter & Search Bar */}
            <AdminCard className="p-4 sm:p-6">
                <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[240px]">
                        <label htmlFor="customerSearch" className="sr-only">Search Customers</label>
                        <input
                            id="customerSearch"
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by email, name, or customer ID..."
                            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <label htmlFor="statusFilter" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Status:
                        </label>
                        <select
                            id="statusFilter"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value as 'all' | 'active' | 'disabled');
                                setPage(1);
                            }}
                            className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-200 focus:border-brand-500 focus:outline-none"
                        >
                            <option value="all">All Accounts</option>
                            <option value="active">Active Only</option>
                            <option value="disabled">Disabled Only</option>
                        </select>
                    </div>

                    <Button type="submit" variant="primary" size="sm" disabled={isLoading}>
                        {isLoading ? 'Searching...' : 'Search'}
                    </Button>

                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            setSearch('');
                            setStatusFilter('all');
                            setPage(1);
                            loadCustomers({ page: 1, search: undefined, status: 'all' });
                        }}
                    >
                        Reset
                    </Button>
                </form>
            </AdminCard>

            {/* Customers Table */}
            <AdminCard className="overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-white">Registered Customers</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Showing {customers.length} of {total} total customers</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm text-slate-300">
                        <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-3.5 font-semibold">Customer</th>
                                <th className="px-6 py-3.5 font-semibold">Customer ID</th>
                                <th className="px-6 py-3.5 font-semibold">Status</th>
                                <th className="px-6 py-3.5 font-semibold">Services</th>
                                <th className="px-6 py-3.5 font-semibold">Orders</th>
                                <th className="px-6 py-3.5 font-semibold">Created</th>
                                <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                            {isLoading && customers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                        Loading customer records...
                                    </td>
                                </tr>
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                        No customer accounts found matching your query.
                                    </td>
                                </tr>
                            ) : (
                                customers.map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-900/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase flex-shrink-0">
                                                    {c.displayName ? c.displayName[0] : (c.email ? c.email[0] : 'U')}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-white truncate max-w-[200px]">
                                                        {c.displayName || 'Unnamed Customer'}
                                                    </div>
                                                    <div className="text-xs text-slate-400 truncate max-w-[200px]">
                                                        {c.email || 'No email attached (OAuth)'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-300">
                                            {c.id}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {c.disabled ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-950 border border-red-800 text-red-300">
                                                        Disabled
                                                    </span>
                                                ) : c.emailVerified ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 border border-emerald-800 text-emerald-300">
                                                        Verified
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-950 border border-amber-800 text-amber-300">
                                                        Unverified
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700">
                                                {c.servicesCount} Active
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700">
                                                {c.ordersCount} Orders
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-400">
                                            {formatDate(c.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenDetail(c.id)}
                                                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600/20 text-brand-300 border border-brand-500/30 hover:bg-brand-600/30 transition-colors"
                                            >
                                                Inspect
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                            Page {page} of {totalPages}
                        </span>
                        <div className="flex space-x-2">
                            <button
                                type="button"
                                disabled={page <= 1 || isLoading}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                disabled={page >= totalPages || isLoading}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </AdminCard>

            {/* Customer Detail Modal */}
            {selectedCustomerId && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="customerModalTitle"
                >
                    <div
                        ref={modalRef}
                        className="relative w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 my-8 space-y-6 max-h-[90vh] overflow-y-auto"
                    >
                        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                            <div>
                                <h3 id="customerModalTitle" className="text-xl font-bold text-white">
                                    Customer Details
                                </h3>
                                <p className="text-xs font-mono text-slate-400 mt-0.5">{selectedCustomerId}</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseDetail}
                                className="text-slate-400 hover:text-white text-2xl font-semibold leading-none"
                                aria-label="Close modal"
                            >
                                &times;
                            </button>
                        </div>

                        {actionError && (
                            <div className="rounded-xl border border-red-800 bg-red-950/60 p-3.5 text-xs text-red-200">
                                {actionError}
                            </div>
                        )}

                        {actionSuccess && (
                            <div className="rounded-xl border border-emerald-800 bg-emerald-950/60 p-3.5 text-xs text-emerald-200">
                                {actionSuccess}
                            </div>
                        )}

                        {detailLoading ? (
                            <div className="py-12 text-center text-slate-400 text-sm">
                                Loading customer records...
                            </div>
                        ) : customerDetail ? (
                            <div className="space-y-6">
                                {/* Profile & Action Banner */}
                                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-white text-base">
                                                {customerDetail.user.displayName || 'No Display Name'}
                                            </span>
                                            {customerDetail.user.disabled ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-950 border border-red-800 text-red-300">
                                                    Disabled
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 border border-emerald-800 text-emerald-300">
                                                    Active
                                                </span>
                                            )}
                                            {customerDetail.user.emailVerified ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/80 border border-emerald-700 text-emerald-300">
                                                    Email Verified
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-950/80 border border-amber-700 text-amber-300">
                                                    Email Unverified
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Email: <span className="font-mono text-slate-200">{customerDetail.user.email || 'None'}</span> &bull; ID: <span className="font-mono text-slate-300">{customerDetail.user.id}</span> &bull; Registered: {formatDate(customerDetail.user.createdAt)}
                                        </p>
                                    </div>

                                    <div>
                                        {customerDetail.user.disabled ? (
                                            <Button
                                                type="button"
                                                variant="primary"
                                                size="sm"
                                                disabled={actionLoading}
                                                onClick={() => handleToggleDisabled(false)}
                                            >
                                                {actionLoading ? 'Updating...' : 'Enable Account'}
                                            </Button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={() => handleToggleDisabled(true)}
                                                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-950/80 text-red-300 border border-red-800 hover:bg-red-900/80 transition-colors disabled:opacity-50"
                                            >
                                                {actionLoading ? 'Updating...' : 'Disable & Revoke Sessions'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Linked Identities */}
                                <AdminSection>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        Linked Auth Identities
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {customerDetail.identities.length === 0 ? (
                                            <p className="text-xs text-slate-500 col-span-2">No linked identities found.</p>
                                        ) : (
                                            customerDetail.identities.map((id) => (
                                                <div key={id.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs">
                                                    <div className="flex items-center justify-between font-semibold text-slate-200">
                                                        <span className="capitalize">{id.provider}</span>
                                                        <span className="text-[10px] text-slate-500 font-mono">{id.id}</span>
                                                    </div>
                                                    <p className="text-slate-400 mt-1 truncate">Subject: {id.providerSubject}</p>
                                                    {id.providerEmail && <p className="text-slate-400 truncate">Email: {id.providerEmail}</p>}
                                                    <p className="text-slate-500 text-[10px] mt-1">Linked: {formatDate(id.createdAt)}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </AdminSection>

                                {/* Active & Historical Services */}
                                <AdminSection>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        Services & Entitlements ({customerDetail.services.length})
                                    </h4>
                                    {customerDetail.services.length === 0 ? (
                                        <p className="text-xs text-slate-500">No active services provisioned.</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs text-slate-300">
                                                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                                                    <tr>
                                                        <th className="px-3 py-2 font-semibold">Service</th>
                                                        <th className="px-3 py-2 font-semibold">Plan Key</th>
                                                        <th className="px-3 py-2 font-semibold">Status</th>
                                                        <th className="px-3 py-2 font-semibold">Started</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800/40">
                                                    {customerDetail.services.map((srv) => (
                                                        <tr key={srv.id}>
                                                            <td className="px-3 py-2.5 font-medium text-white">{srv.serviceName}</td>
                                                            <td className="px-3 py-2.5 font-mono text-slate-400">{srv.planKey}</td>
                                                            <td className="px-3 py-2.5">
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 border border-emerald-800 text-emerald-300 uppercase">
                                                                    {srv.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-slate-400">{formatDate(srv.startedAt)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </AdminSection>

                                {/* Payment Orders History */}
                                <AdminSection>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        Payment Orders ({customerDetail.paymentOrders.length})
                                    </h4>
                                    {customerDetail.paymentOrders.length === 0 ? (
                                        <p className="text-xs text-slate-500">No payment orders found for this customer.</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs text-slate-300">
                                                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                                                    <tr>
                                                        <th className="px-3 py-2 font-semibold">Order ID</th>
                                                        <th className="px-3 py-2 font-semibold">Plan</th>
                                                        <th className="px-3 py-2 font-semibold">Amount</th>
                                                        <th className="px-3 py-2 font-semibold">Status</th>
                                                        <th className="px-3 py-2 font-semibold">Created</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800/40">
                                                    {customerDetail.paymentOrders.map((ord) => (
                                                        <tr key={ord.orderId}>
                                                            <td className="px-3 py-2.5 font-mono text-brand-300">{ord.orderId}</td>
                                                            <td className="px-3 py-2.5 font-medium text-white">{ord.planKey}</td>
                                                            <td className="px-3 py-2.5 text-slate-200">
                                                                ${ord.expectedPriceAmountDecimal} {ord.priceCurrency.toUpperCase()}
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300 uppercase">
                                                                    {ord.internalStatus}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-slate-400">{formatDate(ord.createdAt)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </AdminSection>
                            </div>
                        ) : null}

                        <div className="border-t border-slate-800 pt-4 flex justify-end">
                            <Button type="button" variant="secondary" size="sm" onClick={handleCloseDetail}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
