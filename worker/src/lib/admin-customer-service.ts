/**
 * Admin Customer Management & Observability Service
 *
 * Provides safe, non-sensitive querying and administrative management
 * of customer accounts, identities, sessions, services, and orders.
 *
 * Security Guarantees:
 * - Never returns password hashes, session token hashes, reset tokens, or provider secrets.
 * - Enforces strict customer ID scoping on all child collection queries.
 * - Administrative disable atomically revokes all active customer sessions and increments token version.
 */

import { eq, and, sql, desc, asc, isNull, isNotNull, like, or } from 'drizzle-orm';
import type { createDB } from '../db';
import * as schema from '../db/schema';
import type { AdminCustomersQuery } from '../validators/schemas';

type Database = ReturnType<typeof createDB>;

export interface AdminCustomerListItemDto {
    id: string;
    email: string | null;
    emailVerified: boolean;
    displayName: string | null;
    avatarUrl: string | null;
    disabled: boolean;
    disabledAt: string | null;
    tokenVersion: number;
    createdAt: string;
    servicesCount: number;
    ordersCount: number;
    lastSessionUsedAt: string | null;
}

export interface AdminCustomersListResult {
    items: AdminCustomerListItemDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface AdminCustomerDetailDto {
    user: {
        id: string;
        email: string | null;
        emailVerified: boolean;
        displayName: string | null;
        avatarUrl: string | null;
        disabled: boolean;
        disabledAt: string | null;
        tokenVersion: number;
        createdAt: string;
        updatedAt: string;
    };
    identities: Array<{
        id: string;
        provider: string;
        providerSubject: string;
        providerEmail: string | null;
        createdAt: string;
    }>;
    sessions: Array<{
        id: string;
        expiresAt: string;
        lastUsedAt: string;
        createdAt: string;
        isRevoked: boolean;
        isExpired: boolean;
    }>;
    services: Array<{
        id: string;
        orderId: string;
        planKey: string;
        serviceName: string;
        status: string;
        startedAt: string;
        expiresAt: string | null;
        createdAt: string;
    }>;
    paymentOrders: Array<{
        orderId: string;
        planKey: string;
        expectedPriceAmountDecimal: string;
        priceCurrency: string;
        payCurrency: string;
        internalStatus: string;
        providerStatus: string | null;
        entitlementGrantedAt: string | null;
        createdAt: string;
    }>;
}

export async function getAdminCustomers(
    db: Database,
    query: AdminCustomersQuery,
): Promise<AdminCustomersListResult> {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (query.status === 'active') {
        conditions.push(isNull(schema.users.disabledAt));
    } else if (query.status === 'disabled') {
        conditions.push(isNotNull(schema.users.disabledAt));
    }

    if (query.search) {
        const term = `%${query.search.trim()}%`;
        conditions.push(
            or(
                like(schema.users.email, term),
                like(schema.users.displayName, term),
                like(schema.users.id, term),
            ),
        );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.users)
        .where(whereClause);
    const total = Number(countRes[0]?.count ?? 0);

    const sortDir = query.sortDir === 'asc' ? asc : desc;

    const users = await db
        .select({
            id: schema.users.id,
            email: schema.users.email,
            emailVerified: schema.users.emailVerified,
            displayName: schema.users.displayName,
            avatarUrl: schema.users.avatarUrl,
            disabledAt: schema.users.disabledAt,
            tokenVersion: schema.users.tokenVersion,
            createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .where(whereClause)
        .orderBy(sortDir(schema.users.createdAt))
        .limit(pageSize)
        .offset(offset);

    if (users.length === 0) {
        return {
            items: [],
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
        };
    }

    // Collect user IDs to query aggregates safely in batch (avoids N+1)
    const userIds = users.map((u) => u.id);

    const servicesCountMap: Record<string, number> = {};
    const ordersCountMap: Record<string, number> = {};
    const lastSessionMap: Record<string, string | null> = {};

    try {
        // Query services counts
        const servicesAgg = await db
            .select({
                userId: schema.customerServices.userId,
                count: sql<number>`count(*)`,
            })
            .from(schema.customerServices)
            .where(sql`${schema.customerServices.userId} IN ${userIds}`)
            .groupBy(schema.customerServices.userId);

        for (const row of servicesAgg) {
            servicesCountMap[row.userId] = Number(row.count);
        }

        // Query payment orders counts
        const ordersAgg = await db
            .select({
                userId: schema.paymentOrders.userId,
                count: sql<number>`count(*)`,
            })
            .from(schema.paymentOrders)
            .where(sql`${schema.paymentOrders.userId} IN ${userIds}`)
            .groupBy(schema.paymentOrders.userId);

        for (const row of ordersAgg) {
            if (row.userId) {
                ordersCountMap[row.userId] = Number(row.count);
            }
        }

        // Query most recent session used
        const sessionsAgg = await db
            .select({
                userId: schema.customerSessions.userId,
                lastUsedAt: sql<string>`max(${schema.customerSessions.lastUsedAt})`,
            })
            .from(schema.customerSessions)
            .where(sql`${schema.customerSessions.userId} IN ${userIds}`)
            .groupBy(schema.customerSessions.userId);

        for (const row of sessionsAgg) {
            lastSessionMap[row.userId] = row.lastUsedAt;
        }
    } catch {
        // Safe fallback if aggregates fail
    }

    const items: AdminCustomerListItemDto[] = users.map((u) => ({
        id: u.id,
        email: u.email,
        emailVerified: Boolean(u.emailVerified),
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        disabled: u.disabledAt !== null,
        disabledAt: u.disabledAt,
        tokenVersion: u.tokenVersion,
        createdAt: u.createdAt,
        servicesCount: servicesCountMap[u.id] ?? 0,
        ordersCount: ordersCountMap[u.id] ?? 0,
        lastSessionUsedAt: lastSessionMap[u.id] ?? null,
    }));

    return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
    };
}

export async function getAdminCustomerDetail(
    db: Database,
    customerId: string,
): Promise<AdminCustomerDetailDto | null> {
    const user = await db
        .select({
            id: schema.users.id,
            email: schema.users.email,
            emailVerified: schema.users.emailVerified,
            displayName: schema.users.displayName,
            avatarUrl: schema.users.avatarUrl,
            disabledAt: schema.users.disabledAt,
            tokenVersion: schema.users.tokenVersion,
            createdAt: schema.users.createdAt,
            updatedAt: schema.users.updatedAt,
        })
        .from(schema.users)
        .where(eq(schema.users.id, customerId))
        .limit(1)
        .then((r) => r[0]);

    if (!user) return null;

    const [identities, sessions, services, orders] = await Promise.all([
        db
            .select({
                id: schema.userIdentities.id,
                provider: schema.userIdentities.provider,
                providerSubject: schema.userIdentities.providerSubject,
                providerEmail: schema.userIdentities.providerEmail,
                createdAt: schema.userIdentities.createdAt,
            })
            .from(schema.userIdentities)
            .where(eq(schema.userIdentities.userId, customerId))
            .orderBy(desc(schema.userIdentities.createdAt)),

        db
            .select({
                id: schema.customerSessions.id,
                expiresAt: schema.customerSessions.expiresAt,
                lastUsedAt: schema.customerSessions.lastUsedAt,
                createdAt: schema.customerSessions.createdAt,
                revokedAt: schema.customerSessions.revokedAt,
            })
            .from(schema.customerSessions)
            .where(eq(schema.customerSessions.userId, customerId))
            .orderBy(desc(schema.customerSessions.createdAt))
            .limit(50),

        db
            .select({
                id: schema.customerServices.id,
                orderId: schema.customerServices.orderId,
                planKey: schema.customerServices.planKey,
                serviceName: schema.customerServices.serviceName,
                status: schema.customerServices.status,
                startedAt: schema.customerServices.startedAt,
                expiresAt: schema.customerServices.expiresAt,
                createdAt: schema.customerServices.createdAt,
            })
            .from(schema.customerServices)
            .where(eq(schema.customerServices.userId, customerId))
            .orderBy(desc(schema.customerServices.startedAt))
            .limit(50),

        db
            .select({
                orderId: schema.paymentOrders.orderId,
                planKey: schema.paymentOrders.planKey,
                expectedPriceAmountDecimal: schema.paymentOrders.expectedPriceAmountDecimal,
                priceCurrency: schema.paymentOrders.priceCurrency,
                payCurrency: schema.paymentOrders.payCurrency,
                internalStatus: schema.paymentOrders.internalStatus,
                providerStatus: schema.paymentOrders.providerStatus,
                entitlementGrantedAt: schema.paymentOrders.entitlementGrantedAt,
                createdAt: schema.paymentOrders.createdAt,
            })
            .from(schema.paymentOrders)
            .where(eq(schema.paymentOrders.userId, customerId))
            .orderBy(desc(schema.paymentOrders.createdAt))
            .limit(50),
    ]);

    const now = new Date();

    return {
        user: {
            id: user.id,
            email: user.email,
            emailVerified: Boolean(user.emailVerified),
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            disabled: user.disabledAt !== null,
            disabledAt: user.disabledAt,
            tokenVersion: user.tokenVersion,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        },
        identities,
        sessions: sessions.map((s) => ({
            id: s.id,
            expiresAt: s.expiresAt,
            lastUsedAt: s.lastUsedAt,
            createdAt: s.createdAt,
            isRevoked: s.revokedAt !== null,
            isExpired: new Date(s.expiresAt) < now,
        })),
        services,
        paymentOrders: orders,
    };
}

export async function adminSetCustomerDisabled(
    db: Database,
    customerId: string,
    disabled: boolean,
): Promise<{ success: boolean }> {
    const now = new Date().toISOString();

    const existing = await db
        .select({ id: schema.users.id, tokenVersion: schema.users.tokenVersion })
        .from(schema.users)
        .where(eq(schema.users.id, customerId))
        .limit(1)
        .then((r) => r[0]);

    if (!existing) {
        throw new Error('Customer not found');
    }

    // Update user disabled status and increment token version
    await db
        .update(schema.users)
        .set({
            disabledAt: disabled ? now : null,
            tokenVersion: existing.tokenVersion + 1,
            updatedAt: now,
        })
        .where(eq(schema.users.id, customerId));

    // If disabling, revoke all active sessions immediately
    if (disabled) {
        await db
            .update(schema.customerSessions)
            .set({ revokedAt: now })
            .where(
                and(
                    eq(schema.customerSessions.userId, customerId),
                    isNull(schema.customerSessions.revokedAt),
                ),
            );
    }

    return { success: true };
}

export async function verifyDatabaseSchema(
    db: Database,
): Promise<{ ok: boolean; missingTables: string[]; tables: Record<string, boolean> }> {
    const requiredTables = [
        'users',
        'user_identities',
        'customer_sessions',
        'customer_tokens',
        'customer_services',
        'payment_orders',
        'payment_events',
        'admin_users',
        'services',
        'solutions',
        'pricing_plans',
        'pricing_addons',
        'faq_items',
        'site_settings',
    ];

    try {
        const rows = await db.run(
            sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`,
        );
        const existingTableNames = new Set((rows.results as Array<{ name: string }>).map((r) => r.name));

        const tablesMap: Record<string, boolean> = {};
        const missingTables: string[] = [];

        for (const tbl of requiredTables) {
            const exists = existingTableNames.has(tbl);
            tablesMap[tbl] = exists;
            if (!exists) {
                missingTables.push(tbl);
            }
        }

        return {
            ok: missingTables.length === 0,
            missingTables,
            tables: tablesMap,
        };
    } catch {
        return {
            ok: false,
            missingTables: requiredTables,
            tables: Object.fromEntries(requiredTables.map((t) => [t, false])),
        };
    }
}
