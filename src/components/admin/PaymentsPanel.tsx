import { useState, useEffect, useCallback, useRef } from 'react';
import { AdminCard } from './AdminCard';
import { AdminPageHeader } from './AdminPageHeader';
import { AdminSection } from './AdminSection';
import { Button } from '../common/Button';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import {
    adminGetPaymentOrders,
    adminGetPaymentOrderDetail,
    adminGetPaymentSummary,
    isApiError,
    type AdminPaymentOrderDto,
    type AdminPaymentDetailDto,
    type AdminPaymentSummaryDto,
    type AdminPaymentOrdersQuery,
} from '@/lib/api-client';

interface StatusConfig {
    label: string;
    className: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
    paid: { label: 'Paid', className: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
    waiting: { label: 'Waiting', className: 'bg-amber-100 text-amber-900 border-amber-300' },
    confirming: { label: 'Confirming', className: 'bg-sky-100 text-sky-900 border-sky-300' },
    partially_paid: { label: 'Partially Paid', className: 'bg-orange-100 text-orange-900 border-orange-300' },
    pending: { label: 'Pending', className: 'bg-slate-100 text-slate-800 border-slate-300' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-900 border-red-300' },
    expired: { label: 'Expired', className: 'bg-slate-200 text-slate-700 border-slate-400' },
    refunded: { label: 'Refunded', className: 'bg-purple-100 text-purple-900 border-purple-300' },
};

function PaymentStatusBadge({ status }: { status: string }) {
    const config = STATUS_MAP[status] ?? {
        label: status || 'Unknown',
        className: 'bg-slate-100 text-slate-700 border-slate-300',
    };

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${config.className}`}
        >
            {config.label}
        </span>
    );
}

function formatDateString(isoString?: string | null): string {
    if (!isoString) return '—';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString;
        return d.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch {
        return isoString;
    }
}

export function PaymentsPanel() {
    const [summary, setSummary] = useState<AdminPaymentSummaryDto | null>(null);
    const [orders, setOrders] = useState<AdminPaymentOrderDto[]>([]);
    const [totalOrders, setTotalOrders] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize] = useState(15);

    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<AdminPaymentDetailDto | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);

    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef, detailModalOpen);

    const loadSummary = useCallback(async () => {
        try {
            const data = await adminGetPaymentSummary();
            setSummary(data);
        } catch (err) {
            console.error('Failed to load payment summary:', err);
        }
    }, []);

    const loadOrders = useCallback(async (targetPage: number) => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const q: AdminPaymentOrdersQuery = {
                page: targetPage,
                pageSize,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                query: searchQuery.trim() || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                sortBy: 'created_at',
                sortDir: 'desc',
            };
            const res = await adminGetPaymentOrders(q);
            setOrders(res.items);
            setTotalOrders(res.total);
            setPage(res.page);
            setTotalPages(res.totalPages);
        } catch (err) {
            const msg = isApiError(err) ? err.message : 'Failed to load payment orders';
            setErrorMessage(msg);
        } finally {
            setIsLoading(false);
        }
    }, [pageSize, statusFilter, searchQuery, dateFrom, dateTo]);

    useEffect(() => {
        void loadSummary();
        void loadOrders(1);
    }, [loadSummary, loadOrders]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void loadOrders(1);
    };

    const handleOpenDetail = async (orderId: string) => {
        setDetailModalOpen(true);
        setDetailLoading(true);
        setDetailError(null);
        setSelectedDetail(null);
        try {
            const detail = await adminGetPaymentOrderDetail(orderId);
            setSelectedDetail(detail);
        } catch (err) {
            const msg = isApiError(err) ? err.message : 'Failed to load order details';
            setDetailError(msg);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleCloseDetail = () => {
        setDetailModalOpen(false);
        setSelectedDetail(null);
        setDetailError(null);
    };

    // Construct summary cards array to avoid hard-coded repeated markup
    const summaryCards = [
        {
            label: 'Total Orders',
            value: summary ? String(summary.totalOrders) : '0',
            subtext: `${summary?.byStatus?.['paid'] ?? 0} confirmed`,
            icon: '📦',
        },
        {
            label: 'Confirmed Payments',
            value: summary ? String(summary.byStatus?.['paid'] ?? 0) : '0',
            subtext: 'Entitlement granted',
            icon: '✅',
        },
        {
            label: 'Recent Activity (24h)',
            value: summary ? String(summary.last24Hours) : '0',
            subtext: `${summary?.last7Days ?? 0} in last 7 days`,
            icon: '⏱️',
        },
        {
            label: 'Recorded Paid Revenue',
            value: summary?.paidRevenueByCurrency?.['usd']
                ? `$${summary.paidRevenueByCurrency['usd']} USD`
                : '$0.00 USD',
            subtext: 'Recorded order amounts',
            icon: '💰',
        },
    ];

    return (
        <AdminSection>
            <AdminPageHeader
                title="Payments & Orders"
                description="Read-only operations and audit dashboard for cryptocurrency checkouts and webhook events."
                actions={
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                            void loadSummary();
                            void loadOrders(page);
                        }}
                        disabled={isLoading}
                    >
                        🔄 Refresh
                    </Button>
                }
            />

            {/* Summary Metrics Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {summaryCards.map((card, idx) => (
                    <AdminCard key={idx} className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xl" aria-hidden="true">
                            {card.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">{card.label}</p>
                            <p className="truncate text-xl font-bold text-slate-900">{card.value}</p>
                            <p className="truncate text-xs text-slate-600">{card.subtext}</p>
                        </div>
                    </AdminCard>
                ))}
            </div>

            {/* Filter & Search Bar */}
            <AdminCard>
                <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[180px] flex-1">
                        <label htmlFor="search-input" className="block text-xs font-semibold uppercase tracking-wide text-slate-800 mb-1">
                            Search Order ID / Invoice
                        </label>
                        <input
                            id="search-input"
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="e.g. 550e8400... or starter-bot"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                    </div>

                    <div className="w-full sm:w-44">
                        <label htmlFor="status-filter" className="block text-xs font-semibold uppercase tracking-wide text-slate-800 mb-1">
                            Internal Status
                        </label>
                        <select
                            id="status-filter"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="waiting">Waiting</option>
                            <option value="confirming">Confirming</option>
                            <option value="partially_paid">Partially Paid</option>
                            <option value="paid">Paid</option>
                            <option value="failed">Failed</option>
                            <option value="expired">Expired</option>
                            <option value="refunded">Refunded</option>
                        </select>
                    </div>

                    <div className="w-full sm:w-36">
                        <label htmlFor="date-from" className="block text-xs font-semibold uppercase tracking-wide text-slate-800 mb-1">
                            From Date
                        </label>
                        <input
                            id="date-from"
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                    </div>

                    <div className="w-full sm:w-36">
                        <label htmlFor="date-to" className="block text-xs font-semibold uppercase tracking-wide text-slate-800 mb-1">
                            To Date
                        </label>
                        <input
                            id="date-to"
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button type="submit" size="sm" variant="primary">
                            Filter
                        </Button>
                        {(searchQuery || statusFilter !== 'all' || dateFrom || dateTo) && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setSearchQuery('');
                                    setStatusFilter('all');
                                    setDateFrom('');
                                    setDateTo('');
                                }}
                            >
                                Reset
                            </Button>
                        )}
                    </div>
                </form>
            </AdminCard>

            {/* Orders Table */}
            <AdminCard className="overflow-hidden p-0">
                {errorMessage && (
                    <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center justify-between">
                        <span>{errorMessage}</span>
                        <Button size="sm" variant="outline" onClick={() => void loadOrders(page)}>
                            Retry
                        </Button>
                    </div>
                )}

                {isLoading && (
                    <div className="p-8 text-center text-sm text-slate-500">
                        <span className="inline-block animate-spin mr-2">⏳</span> Loading payment orders...
                    </div>
                )}

                {!isLoading && !errorMessage && orders.length === 0 && (
                    <div className="p-12 text-center">
                        <p className="text-base font-semibold text-slate-700">No payment orders found</p>
                        <p className="text-xs text-slate-500 mt-1">Orders created via crypto checkout will appear here.</p>
                    </div>
                )}

                {!isLoading && !errorMessage && orders.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-700">
                            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Order ID</th>
                                    <th className="px-4 py-3">Plan</th>
                                    <th className="px-4 py-3">Amount</th>
                                    <th className="px-4 py-3">Pay Coin</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Provider</th>
                                    <th className="px-4 py-3">Created</th>
                                    <th className="px-4 py-3">Entitled</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-normal">
                                {orders.map((o) => (
                                    <tr key={o.orderId} className="hover:bg-slate-50/75 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs text-slate-900">
                                            <span title={o.orderId}>{o.orderId.slice(0, 8)}...{o.orderId.slice(-4)}</span>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-900">
                                            <div>{o.planName}</div>
                                            <div className="text-xs text-slate-500 font-mono">{o.planKey}</div>
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-slate-900">
                                            ${o.priceAmountDecimal} <span className="text-xs uppercase text-slate-500">{o.priceCurrency}</span>
                                        </td>
                                        <td className="px-4 py-3 uppercase font-mono text-xs text-slate-800">
                                            {o.payCurrency}
                                        </td>
                                        <td className="px-4 py-3">
                                            <PaymentStatusBadge status={o.internalStatus} />
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600">
                                            {o.providerStatus || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                                            {formatDateString(o.createdAt)}
                                        </td>
                                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                                            {o.entitlementGrantedAt ? (
                                                <span className="text-emerald-700 font-medium">
                                                    ✓ {formatDateString(o.entitlementGrantedAt)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => void handleOpenDetail(o.orderId)}
                                            >
                                                Details {o.eventCount > 0 && `(${o.eventCount})`}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {!isLoading && totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs text-slate-600">
                            Showing page <span className="font-semibold text-slate-900">{page}</span> of{' '}
                            <span className="font-semibold text-slate-900">{totalPages}</span> ({totalOrders} orders)
                        </p>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page <= 1 || isLoading}
                                onClick={() => void loadOrders(page - 1)}
                            >
                                Previous
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page >= totalPages || isLoading}
                                onClick={() => void loadOrders(page + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </AdminCard>

            {/* Order Detail Modal */}
            {detailModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="order-detail-title"
                >
                    <div
                        ref={modalRef}
                        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white text-slate-900 shadow-2xl overflow-hidden"
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                            <div>
                                <h3 id="order-detail-title" className="text-lg font-bold text-slate-900">
                                    Payment Order Details
                                </h3>
                                <p className="text-xs text-slate-500 font-mono">
                                    {selectedDetail?.order?.orderId}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseDetail}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Close details"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {detailLoading && (
                                <div className="p-8 text-center text-sm text-slate-500">
                                    <span className="inline-block animate-spin mr-2">⏳</span> Loading order details...
                                </div>
                            )}

                            {detailError && (
                                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                                    {detailError}
                                </div>
                            )}

                            {selectedDetail && (
                                <>
                                    {/* Summary Grid */}
                                    <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase">Plan</p>
                                            <p className="font-bold text-slate-900">{selectedDetail.order.planName}</p>
                                            <p className="text-xs text-slate-500 font-mono">{selectedDetail.order.planKey}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase">Billing Mode</p>
                                            <p className="font-semibold text-slate-800 capitalize">
                                                {selectedDetail.order.billingMode.replace('_', ' ')}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase">Price Amount</p>
                                            <p className="text-base font-bold text-slate-900">
                                                ${selectedDetail.order.priceAmountDecimal}{' '}
                                                <span className="text-xs uppercase text-slate-500 font-normal">
                                                    {selectedDetail.order.priceCurrency}
                                                </span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase">Pay Currency</p>
                                            <p className="font-bold uppercase font-mono text-slate-900">
                                                {selectedDetail.order.payCurrency}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase">Internal Status</p>
                                            <div className="mt-1">
                                                <PaymentStatusBadge status={selectedDetail.order.internalStatus} />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase">Provider Status</p>
                                            <p className="font-semibold text-slate-800">
                                                {selectedDetail.order.providerStatus || 'None'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase">Created</p>
                                            <p className="text-xs text-slate-700">{formatDateString(selectedDetail.order.createdAt)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase">Entitlement</p>
                                            <p className="text-xs">
                                                {selectedDetail.order.entitlementGrantedAt ? (
                                                    <span className="font-semibold text-emerald-700">
                                                        ✓ Granted {formatDateString(selectedDetail.order.entitlementGrantedAt)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500">Not granted</span>
                                                )}
                                            </p>
                                        </div>
                                        {selectedDetail.order.providerInvoiceId && (
                                            <div className="col-span-2">
                                                <p className="text-xs font-semibold text-slate-500 uppercase">NOWPayments Invoice ID</p>
                                                <p className="text-xs font-mono text-slate-800">{selectedDetail.order.providerInvoiceId}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Event Timeline */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                                            <span>Webhook Audit Timeline</span>
                                            <span className="text-xs font-normal text-slate-500">
                                                {selectedDetail.events.length} event{selectedDetail.events.length === 1 ? '' : 's'}
                                            </span>
                                        </h4>

                                        {selectedDetail.events.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                                                No webhook events recorded yet for this order.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedDetail.events.map((evt) => (
                                                    <div
                                                        key={evt.id}
                                                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                                                    >
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-slate-900">
                                                                    IPN: {evt.providerStatus}
                                                                </span>
                                                                <PaymentStatusBadge status={evt.providerStatus} />
                                                            </div>
                                                            <p className="font-mono text-slate-500">
                                                                Payment ID: {evt.providerPaymentId}
                                                            </p>
                                                        </div>
                                                        <div className="text-right text-slate-500 whitespace-nowrap">
                                                            {formatDateString(evt.receivedAt)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex justify-end">
                            <Button size="sm" variant="secondary" onClick={handleCloseDetail}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AdminSection>
    );
}
