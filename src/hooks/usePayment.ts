/**
 * React Query hooks for the payment/crypto-checkout domain.
 *
 * - `usePaymentCurrencies` — fetches supported pay currencies from the backend.
 * - `useOrderStatus` — polls the canonical order status with exponential backoff.
 *
 * Neither hook calls NOWPayments directly — all requests go through the Worker.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchPaymentCurrencies, fetchOrderStatus } from '@/lib/api-client';
import type { OrderStatusResponse, PaymentCurrencyData } from '@/lib/api-client';

// ─── Currency list ────────────────────────────────────────────────────────────

export function usePaymentCurrencies() {
    return useQuery<PaymentCurrencyData[], Error>({
        queryKey: ['payment', 'currencies'],
        queryFn: fetchPaymentCurrencies,
        // Currencies are nearly static — cache for the session
        staleTime: 10 * 60 * 1000,  // 10 minutes
        gcTime: 30 * 60 * 1000,
        retry: 2,
    });
}

// ─── Order status polling ─────────────────────────────────────────────────────

const POLLING_STATUSES = new Set(['pending', 'waiting', 'confirming', 'partially_paid']);

/**
 * Polls the backend for the canonical order status.
 *
 * Polling strategy:
 * - Active polling (5 s) while status is pending/waiting/confirming/partially_paid.
 * - Stops automatically once the status reaches a terminal state.
 * - Disabled entirely when `orderId` or `statusToken` is falsy.
 */
export function useOrderStatus(orderId: string | null, statusToken: string | null) {
    const enabled = Boolean(orderId && statusToken);

    return useQuery<OrderStatusResponse, Error>({
        queryKey: ['payment', 'order', orderId],
        queryFn: () => fetchOrderStatus(orderId!, statusToken!),
        enabled,
        // Poll every 5 seconds while the status is non-terminal
        refetchInterval: (query) => {
            const data = query.state.data;
            if (!data) return 5_000;
            if (POLLING_STATUSES.has(data.status)) return 5_000;
            return false; // stop polling on terminal status
        },
        refetchIntervalInBackground: false,
        staleTime: 0, // always consider order status fresh from server
        retry: (failureCount, error) => {
            // Do not retry 4xx errors (auth / not found).
            // Cast through unknown first — required by strict tsc -b since `error`
            // is typed as Error but we need to inspect a non-standard `status` field.
            const maybeApiError = error as unknown as Record<string, unknown>;
            if (typeof maybeApiError?.['status'] === 'number') {
                const status = maybeApiError['status'] as number;
                if (status >= 400 && status < 500) return false;
            }
            return failureCount < 3;
        },
    });
}
