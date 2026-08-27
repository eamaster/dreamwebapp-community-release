/**
 * Payment domain types shared across the payment subsystem.
 *
 * - `InternalPaymentStatus` is the canonical normalized status stored in the DB.
 * - `NowPaymentsProviderStatus` is the raw status string returned by NOWPayments.
 * - `mapProviderStatus` is the single authoritative mapping layer.
 * - `TERMINAL_STATUSES` defines which statuses are final and must never be downgraded.
 * - `BillingMode` defines the payment frequency model.
 */

// ─── Internal Status ──────────────────────────────────────────────────────────

export type InternalPaymentStatus =
    | 'pending'
    | 'waiting'
    | 'confirming'
    | 'partially_paid'
    | 'paid'
    | 'failed'
    | 'expired'
    | 'refunded';

// ─── Billing Mode ─────────────────────────────────────────────────────────────

/**
 * All crypto hosted invoice checkouts represent one-time settlement payments.
 * We do not claim or imply automated recurring crypto subscription debits.
 */
export type BillingMode = 'one_time' | 'setup' | 'monthly';

// ─── Terminal Statuses ────────────────────────────────────────────────────────

export const TERMINAL_STATUSES = new Set<InternalPaymentStatus>([
    'paid',
    'refunded',
    'expired',
    'failed',
]);

// ─── Status Transition Whitelist ──────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Readonly<Record<InternalPaymentStatus, ReadonlySet<InternalPaymentStatus>>> = {
    pending:        new Set<InternalPaymentStatus>(['waiting', 'expired', 'failed']),
    waiting:        new Set<InternalPaymentStatus>(['confirming', 'partially_paid', 'paid', 'expired', 'failed']),
    confirming:     new Set<InternalPaymentStatus>(['paid', 'partially_paid', 'failed', 'expired']),
    partially_paid: new Set<InternalPaymentStatus>(['paid', 'confirming', 'failed', 'expired', 'refunded']),
    paid:           new Set<InternalPaymentStatus>(),
    failed:         new Set<InternalPaymentStatus>(),
    expired:        new Set<InternalPaymentStatus>(),
    refunded:       new Set<InternalPaymentStatus>(),
};

export function isLegalTransition(from: InternalPaymentStatus, to: InternalPaymentStatus): boolean {
    if (from === to) return true;
    return ALLOWED_TRANSITIONS[from].has(to);
}

// ─── Provider → Internal Mapping ─────────────────────────────────────────────

/**
 * Maps raw NOWPayments status string to internal normalized status.
 * Covers: created, waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired.
 */
export function mapProviderStatus(providerStatus: string): InternalPaymentStatus {
    const normalized = providerStatus.trim().toLowerCase();
    switch (normalized) {
        case 'created':        return 'waiting';
        case 'waiting':        return 'waiting';
        case 'confirming':     return 'confirming';
        case 'confirmed':      return 'confirming';
        case 'sending':        return 'confirming';
        case 'partially_paid': return 'partially_paid';
        case 'finished':       return 'paid';
        case 'failed':         return 'failed';
        case 'refunded':       return 'refunded';
        case 'expired':        return 'expired';
        default:               return 'pending';
    }
}

// ─── Human-readable labels ────────────────────────────────────────────────────

export const STATUS_LABELS: Readonly<Record<InternalPaymentStatus, string>> = {
    pending:        'Waiting for payment',
    waiting:        'Waiting for payment',
    confirming:     'Confirming on network',
    partially_paid: 'Partially paid — please contact support',
    paid:           'Payment complete',
    failed:         'Payment failed',
    expired:        'Payment expired',
    refunded:       'Refunded',
};
