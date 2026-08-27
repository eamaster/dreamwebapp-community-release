import type { PaymentStatus } from '@/lib/api-client';

interface PaymentStatusBadgeProps {
    status: PaymentStatus;
    label: string;
    className?: string;
}

const STATUS_CONFIG: Record<PaymentStatus, { icon: string; colorClasses: string }> = {
    pending:        { icon: '⏳', colorClasses: 'bg-slate-100 text-slate-700 border-slate-300' },
    waiting:        { icon: '⏳', colorClasses: 'bg-amber-50 text-amber-700 border-amber-300' },
    confirming:     { icon: '🔄', colorClasses: 'bg-blue-50 text-blue-700 border-blue-300' },
    partially_paid: { icon: '⚠️', colorClasses: 'bg-orange-50 text-orange-700 border-orange-300' },
    paid:           { icon: '✅', colorClasses: 'bg-green-50 text-green-700 border-green-300' },
    failed:         { icon: '❌', colorClasses: 'bg-red-50 text-red-700 border-red-300' },
    expired:        { icon: '⏰', colorClasses: 'bg-slate-100 text-slate-500 border-slate-300' },
    refunded:       { icon: '↩️', colorClasses: 'bg-purple-50 text-purple-700 border-purple-300' },
};

/**
 * Accessible status badge for payment status display.
 * Uses semantic color-coding with an icon and label.
 */
export function PaymentStatusBadge({ status, label, className = '' }: PaymentStatusBadgeProps) {
    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    return (
        <span
            role="status"
            aria-label={`Payment status: ${label}`}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${config.colorClasses} ${className}`}
        >
            <span aria-hidden="true">{config.icon}</span>
            {label}
        </span>
    );
}
