/**
 * Payment repository — D1-backed persistence for payment_orders and payment_events.
 *
 * Rules:
 * - Order IDs are cryptographically random UUIDv4 created using crypto.getRandomValues.
 * - Only SHA-256 hashes of status tokens are stored in the DB.
 * - Order status updates strictly enforce legal transition rules and prevent terminal downgrades.
 * - Webhook event deduplication is enforced at the database level via UNIQUE event_fingerprint.
 * - Entitlement is recorded once and never cleared.
 */

import { eq, and, or, like, gte, lte, asc, desc, sql, inArray } from 'drizzle-orm';
import type { DrizzleDB } from '../../db';
import * as schema from '../../db/schema';
import type { PaymentOrderRow, PaymentOrderInsert, PaymentEventInsert } from '../../db/schema';
import { isLegalTransition } from './types';
import type { InternalPaymentStatus } from './types';
import { SERVER_CRYPTO_CATALOG } from './catalog';
import { sumDecimalStrings } from './money';

export type { PaymentOrderRow } from '../../db/schema';

// ─── Cryptographic ID and Token Generation ────────────────────────────────────

/**
 * Generates a cryptographically random UUIDv4 using crypto.getRandomValues.
 */
export function generateOrderId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // Variant RFC4122
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generates a 256-bit cryptographically secure status token for unauthenticated polling.
 * Returns { rawToken, tokenHash } — only tokenHash is saved to D1.
 */
export async function generateStatusToken(): Promise<{ rawToken: string; tokenHash: string }> {
    const rawBytes = crypto.getRandomValues(new Uint8Array(32));
    const rawToken = Array.from(rawBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return { rawToken, tokenHash };
}

// ─── Create order ─────────────────────────────────────────────────────────────

export type CreateOrderInput = Omit<
    PaymentOrderInsert,
    'orderId' | 'internalStatus' | 'providerStatus' | 'createdAt' | 'updatedAt' | 'entitlementGrantedAt'
> & {
    orderId: string;
};

export async function createOrder(db: DrizzleDB, input: CreateOrderInput): Promise<PaymentOrderRow> {
    const rows = await db
        .insert(schema.paymentOrders)
        .values({
            ...input,
            internalStatus: 'pending',
        })
        .returning();

    const row = rows[0];
    if (!row) throw new Error('Failed to create payment order: no row returned');
    return row;
}

// ─── Get order ────────────────────────────────────────────────────────────────

export async function getOrderById(db: DrizzleDB, orderId: string): Promise<PaymentOrderRow | null> {
    const rows = await db
        .select()
        .from(schema.paymentOrders)
        .where(eq(schema.paymentOrders.orderId, orderId))
        .limit(1);
    return rows[0] ?? null;
}

/** Looks up an order by its NOWPayments provider_payment_id. */
export async function getOrderByProviderPaymentId(db: DrizzleDB, providerPaymentId: string): Promise<PaymentOrderRow | null> {
    const rows = await db
        .select()
        .from(schema.paymentOrders)
        .where(eq(schema.paymentOrders.providerPaymentId, providerPaymentId))
        .limit(1);
    return rows[0] ?? null;
}

// ─── Update order status ──────────────────────────────────────────────────────

export interface OrderStatusPatch {
    providerPaymentId?: string;
    providerInvoiceId?: string;
    providerStatus?: string;
    internalStatus?: InternalPaymentStatus;
    expectedPayAmountDecimal?: string;
}

/**
 * Applies a patch to a payment order with legal state machine transition enforcement.
 */
export async function updateOrderStatus(
    db: DrizzleDB,
    orderId: string,
    patch: OrderStatusPatch,
): Promise<PaymentOrderRow> {
    const current = await getOrderById(db, orderId);
    if (!current) throw new Error(`Order not found: ${orderId}`);

    const newInternalStatus = patch.internalStatus ?? (current.internalStatus as InternalPaymentStatus);
    const currentInternalStatus = current.internalStatus as InternalPaymentStatus;

    if (!isLegalTransition(currentInternalStatus, newInternalStatus)) {
        throw new Error(
            `Illegal status transition: ${currentInternalStatus} -> ${newInternalStatus} for order ${orderId}`
        );
    }

    // Set entitlementGrantedAt once when status reaches paid
    const entitlementGrantedAt =
        current.entitlementGrantedAt !== null
            ? current.entitlementGrantedAt
            : newInternalStatus === 'paid'
                ? new Date().toISOString()
                : null;

    const updatedAt = new Date().toISOString();

    const updated = await db
        .update(schema.paymentOrders)
        .set({
            ...(patch.providerPaymentId !== undefined && { providerPaymentId: patch.providerPaymentId }),
            ...(patch.providerInvoiceId !== undefined && { providerInvoiceId: patch.providerInvoiceId }),
            ...(patch.providerStatus !== undefined && { providerStatus: patch.providerStatus }),
            internalStatus: newInternalStatus,
            ...(patch.expectedPayAmountDecimal !== undefined && { expectedPayAmountDecimal: patch.expectedPayAmountDecimal }),
            ...(entitlementGrantedAt !== null && { entitlementGrantedAt }),
            updatedAt,
        })
        .where(eq(schema.paymentOrders.orderId, orderId))
        .returning();

    const row = updated[0];
    if (!row) throw new Error(`Failed to update order ${orderId}`);
    return row;
}

// ─── Record event ─────────────────────────────────────────────────────────────

export type RecordEventInput = Omit<PaymentEventInsert, 'id' | 'receivedAt'>;

/**
 * Idempotently records a payment event in payment_events.
 * Returns false if already recorded (UNIQUE event_fingerprint constraint), true if new.
 */
export async function recordEvent(db: DrizzleDB, input: RecordEventInput): Promise<boolean> {
    try {
        await db.insert(schema.paymentEvents).values({
            ...input,
            receivedAt: new Date().toISOString(),
        });
        return true;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('UNIQUE') || msg.includes('unique')) {
            return false;
        }
        throw err;
    }
}

// ─── Verify status token ──────────────────────────────────────────────────────

/**
 * Verifies that a raw status token matches the stored SHA-256 hash.
 */
export async function verifyStatusToken(order: PaymentOrderRow, rawToken: string): Promise<boolean> {
    if (!order.statusTokenHash || !rawToken) return false;
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken.trim()));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

    const a = order.statusTokenHash;
    const b = tokenHash;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
    }
    return diff === 0;
}

// ─── Admin Observability DTOs & Queries ────────────────────────────────────────

export interface SafeAdminPaymentOrderDto {
    orderId: string;
    createdAt: string;
    updatedAt: string;
    planKey: string;
    planName: string;
    billingMode: 'one_time' | 'setup' | 'monthly';
    internalStatus: InternalPaymentStatus;
    priceAmountDecimal: string;
    priceCurrency: string;
    payCurrency: string;
    providerInvoiceId: string | null;
    providerStatus: string | null;
    entitlementGrantedAt: string | null;
    eventCount: number;
}

export interface SafeAdminPaymentEventDto {
    id: number;
    orderId: string;
    providerStatus: string;
    providerPaymentId: string;
    receivedAt: string;
}

export interface SafeAdminPaymentDetailDto {
    order: SafeAdminPaymentOrderDto;
    events: SafeAdminPaymentEventDto[];
}

export interface SafeAdminPaymentSummaryDto {
    totalOrders: number;
    byStatus: Record<InternalPaymentStatus, number>;
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    paidRevenueByCurrency: Record<string, string>;
}

export interface AdminPaymentOrdersParams {
    page?: number;
    pageSize?: number;
    status?: InternalPaymentStatus | 'all';
    planKey?: string;
    dateFrom?: string;
    dateTo?: string;
    query?: string;
    sortBy?: 'created_at' | 'updated_at' | 'entitlement_granted_at';
    sortDir?: 'asc' | 'desc';
}

function resolvePlanDisplayName(planKey: string): string {
    const catalogItem = SERVER_CRYPTO_CATALOG[planKey];
    if (catalogItem?.planName) return catalogItem.planName;
    return planKey.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Lists payment orders for the admin dashboard with safe pagination, filtering, and sorting.
 * Excludes all sensitive tokens, hashes, secrets, and raw IPN bodies.
 */
export async function getAdminPaymentOrders(
    db: DrizzleDB,
    params: AdminPaymentOrdersParams = {},
): Promise<{
    items: SafeAdminPaymentOrderDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (params.status && params.status !== 'all') {
        conditions.push(eq(schema.paymentOrders.internalStatus, params.status));
    }

    if (params.planKey && params.planKey.trim()) {
        conditions.push(eq(schema.paymentOrders.planKey, params.planKey.trim().toLowerCase()));
    }

    if (params.dateFrom && params.dateFrom.trim()) {
        conditions.push(gte(schema.paymentOrders.createdAt, params.dateFrom.trim()));
    }

    if (params.dateTo && params.dateTo.trim()) {
        conditions.push(lte(schema.paymentOrders.createdAt, params.dateTo.trim()));
    }

    if (params.query && params.query.trim()) {
        const q = `%${params.query.trim()}%`;
        conditions.push(
            or(
                like(schema.paymentOrders.orderId, q),
                like(schema.paymentOrders.providerInvoiceId, q),
                like(schema.paymentOrders.planKey, q),
            ),
        );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort column and direction
    const sortDir = params.sortDir === 'asc' ? asc : desc;
    const orderClause =
        params.sortBy === 'updated_at'
            ? sortDir(schema.paymentOrders.updatedAt)
            : params.sortBy === 'entitlement_granted_at'
                ? sortDir(schema.paymentOrders.entitlementGrantedAt)
                : sortDir(schema.paymentOrders.createdAt);

    // Count total matching records
    const countRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.paymentOrders)
        .where(whereClause);
    const total = Number(countRes[0]?.count ?? 0);

    // Fetch page rows
    const rows = await db
        .select()
        .from(schema.paymentOrders)
        .where(whereClause)
        .orderBy(orderClause)
        .limit(pageSize)
        .offset(offset);

    // Fetch event counts for returned order IDs
    const orderIds = rows.map((r) => r.orderId);
    const eventCountMap: Record<string, number> = {};

    if (orderIds.length > 0) {
        const eventCounts = await db
            .select({
                orderId: schema.paymentEvents.orderId,
                count: sql<number>`count(*)`,
            })
            .from(schema.paymentEvents)
            .where(inArray(schema.paymentEvents.orderId, orderIds))
            .groupBy(schema.paymentEvents.orderId);

        for (const ec of eventCounts) {
            eventCountMap[ec.orderId] = Number(ec.count);
        }
    }

    const items: SafeAdminPaymentOrderDto[] = rows.map((r) => ({
        orderId: r.orderId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        planKey: r.planKey,
        planName: resolvePlanDisplayName(r.planKey),
        billingMode: r.billingMode,
        internalStatus: r.internalStatus as InternalPaymentStatus,
        priceAmountDecimal: r.expectedPriceAmountDecimal,
        priceCurrency: r.priceCurrency,
        payCurrency: r.payCurrency,
        providerInvoiceId: r.providerInvoiceId,
        providerStatus: r.providerStatus,
        entitlementGrantedAt: r.entitlementGrantedAt,
        eventCount: eventCountMap[r.orderId] ?? 0,
    }));

    return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
    };
}

/**
 * Gets a single payment order with its chronological event timeline.
 */
export async function getAdminPaymentOrderDetail(
    db: DrizzleDB,
    orderId: string,
): Promise<SafeAdminPaymentDetailDto | null> {
    const order = await getOrderById(db, orderId);
    if (!order) return null;

    const events = await db
        .select({
            id: schema.paymentEvents.id,
            orderId: schema.paymentEvents.orderId,
            providerStatus: schema.paymentEvents.providerStatus,
            providerPaymentId: schema.paymentEvents.providerPaymentId,
            receivedAt: schema.paymentEvents.receivedAt,
        })
        .from(schema.paymentEvents)
        .where(eq(schema.paymentEvents.orderId, orderId))
        .orderBy(asc(schema.paymentEvents.receivedAt));

    const safeOrder: SafeAdminPaymentOrderDto = {
        orderId: order.orderId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        planKey: order.planKey,
        planName: resolvePlanDisplayName(order.planKey),
        billingMode: order.billingMode,
        internalStatus: order.internalStatus as InternalPaymentStatus,
        priceAmountDecimal: order.expectedPriceAmountDecimal,
        priceCurrency: order.priceCurrency,
        payCurrency: order.payCurrency,
        providerInvoiceId: order.providerInvoiceId,
        providerStatus: order.providerStatus,
        entitlementGrantedAt: order.entitlementGrantedAt,
        eventCount: events.length,
    };

    return {
        order: safeOrder,
        events: events.map((e) => ({
            id: e.id,
            orderId: e.orderId,
            providerStatus: e.providerStatus,
            providerPaymentId: e.providerPaymentId,
            receivedAt: e.receivedAt,
        })),
    };
}

/**
 * Aggregates operational payment statistics for the admin dashboard summary.
 * Uses exact BigInt decimal string arithmetic for paid revenue calculation.
 */
export async function getAdminPaymentSummary(db: DrizzleDB): Promise<SafeAdminPaymentSummaryDto> {
    const rows = await db
        .select({
            internalStatus: schema.paymentOrders.internalStatus,
            createdAt: schema.paymentOrders.createdAt,
            priceCurrency: schema.paymentOrders.priceCurrency,
            expectedPriceAmountDecimal: schema.paymentOrders.expectedPriceAmountDecimal,
        })
        .from(schema.paymentOrders);

    const now = Date.now();
    const cutoff24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const cutoff7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const byStatus: Record<InternalPaymentStatus, number> = {
        pending: 0,
        waiting: 0,
        confirming: 0,
        partially_paid: 0,
        paid: 0,
        failed: 0,
        expired: 0,
        refunded: 0,
    };

    let last24Hours = 0;
    let last7Days = 0;
    let last30Days = 0;

    const paidAmountsByCurrency: Record<string, string[]> = {};

    for (const r of rows) {
        const st = r.internalStatus as InternalPaymentStatus;
        if (byStatus[st] !== undefined) {
            byStatus[st]++;
        }

        if (r.createdAt >= cutoff24h) last24Hours++;
        if (r.createdAt >= cutoff7d) last7Days++;
        if (r.createdAt >= cutoff30d) last30Days++;

        if (st === 'paid') {
            const curr = (r.priceCurrency || 'usd').toLowerCase();
            if (!paidAmountsByCurrency[curr]) {
                paidAmountsByCurrency[curr] = [];
            }
            paidAmountsByCurrency[curr]!.push(r.expectedPriceAmountDecimal);
        }
    }

    const paidRevenueByCurrency: Record<string, string> = {};
    for (const [currency, amounts] of Object.entries(paidAmountsByCurrency)) {
        paidRevenueByCurrency[currency] = sumDecimalStrings(amounts, 2);
    }

    return {
        totalOrders: rows.length,
        byStatus,
        last24Hours,
        last7Days,
        last30Days,
        paidRevenueByCurrency,
    };
}

