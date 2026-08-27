/**
 * Customer account routes — mounted at /api/v1/account
 *
 * All endpoints require customerAuthMiddleware and filter exclusively
 * by the authenticated customer.userId.
 *
 *   GET /services              -> customer's purchased services
 *   GET /services/:serviceId   -> service details
 *   GET /payments              -> customer's payment order history
 *   GET /payments/:orderId     -> payment order details
 */

import { Hono } from 'hono';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import type { Env } from '../types/env';
import { createDB } from '../db';
import * as schema from '../db/schema';
import { customerAuthMiddleware, clearCustomerCookies, type CustomerHonoVariables } from '../middleware/customer-auth';
import { CustomerPaginationQuerySchema } from '../validators/schemas';
import { SERVER_CRYPTO_CATALOG } from '../lib/payments/catalog';
import {
    checkCustomerDeletionEligibility,
    deleteCustomerAccount,
} from '../lib/customer-auth-service';

export const accountRouter = new Hono<{ Bindings: Env; Variables: CustomerHonoVariables }>();

accountRouter.use('/*', customerAuthMiddleware);

function resolvePlanDisplayName(planKey: string): string {
    const catalogItem = SERVER_CRYPTO_CATALOG[planKey];
    if (catalogItem?.planName) return catalogItem.planName;
    return planKey.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── GET /services ────────────────────────────────────────────────────────────

accountRouter.get('/services', async (c) => {
    const customer = c.get('customer')!;
    const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams);
    const parsed = CustomerPaginationQuerySchema.safeParse(rawQuery);

    const page = parsed.success ? parsed.data.page : 1;
    const pageSize = parsed.success ? parsed.data.pageSize : 20;
    const offset = (page - 1) * pageSize;

    const db = createDB(c.env.DB);

    const conditions = [eq(schema.customerServices.userId, customer.userId)];
    if (parsed.success && parsed.data.status && parsed.data.status !== 'all') {
        conditions.push(eq(schema.customerServices.status, parsed.data.status as 'active' | 'provisioning' | 'completed' | 'suspended' | 'cancelled'));
    }

    const whereClause = and(...conditions);

    const countRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.customerServices)
        .where(whereClause);
    const total = Number(countRes[0]?.count ?? 0);

    const sortDir = parsed.success && parsed.data.sortDir === 'asc' ? asc : desc;

    const rows = await db
        .select()
        .from(schema.customerServices)
        .where(whereClause)
        .orderBy(sortDir(schema.customerServices.startedAt))
        .limit(pageSize)
        .offset(offset);

    const items = rows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        planKey: r.planKey,
        serviceName: r.serviceName,
        status: r.status,
        startedAt: r.startedAt,
        expiresAt: r.expiresAt,
        nextReviewAt: r.nextReviewAt,
        createdAt: r.createdAt,
    }));

    return c.json({
        data: {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
    });
});

// ─── GET /services/:serviceId ─────────────────────────────────────────────────

accountRouter.get('/services/:serviceId', async (c) => {
    const customer = c.get('customer')!;
    const serviceId = c.req.param('serviceId');

    const db = createDB(c.env.DB);

    const service = await db
        .select()
        .from(schema.customerServices)
        .where(
            and(
                eq(schema.customerServices.id, serviceId),
                eq(schema.customerServices.userId, customer.userId),
            ),
        )
        .limit(1)
        .then((r) => r[0]);

    if (!service) {
        return c.json({ error: 'Service not found or unauthorized' }, 404);
    }

    // Fetch associated payment order summary
    const order = await db
        .select({
            orderId: schema.paymentOrders.orderId,
            priceAmountDecimal: schema.paymentOrders.expectedPriceAmountDecimal,
            priceCurrency: schema.paymentOrders.priceCurrency,
            payCurrency: schema.paymentOrders.payCurrency,
            internalStatus: schema.paymentOrders.internalStatus,
            entitlementGrantedAt: schema.paymentOrders.entitlementGrantedAt,
            createdAt: schema.paymentOrders.createdAt,
        })
        .from(schema.paymentOrders)
        .where(eq(schema.paymentOrders.orderId, service.orderId))
        .limit(1)
        .then((r) => r[0]);

    return c.json({
        data: {
            service: {
                id: service.id,
                orderId: service.orderId,
                planKey: service.planKey,
                serviceName: service.serviceName,
                status: service.status,
                startedAt: service.startedAt,
                expiresAt: service.expiresAt,
                nextReviewAt: service.nextReviewAt,
                createdAt: service.createdAt,
            },
            order: order ?? null,
        },
    });
});

// ─── GET /payments ────────────────────────────────────────────────────────────

accountRouter.get('/payments', async (c) => {
    const customer = c.get('customer')!;
    const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams);
    const parsed = CustomerPaginationQuerySchema.safeParse(rawQuery);

    const page = parsed.success ? parsed.data.page : 1;
    const pageSize = parsed.success ? parsed.data.pageSize : 20;
    const offset = (page - 1) * pageSize;

    const db = createDB(c.env.DB);

    const conditions = [eq(schema.paymentOrders.userId, customer.userId)];
    if (parsed.success && parsed.data.status && parsed.data.status !== 'all') {
        conditions.push(eq(schema.paymentOrders.internalStatus, parsed.data.status as 'pending' | 'waiting' | 'confirming' | 'partially_paid' | 'paid' | 'failed' | 'expired' | 'refunded'));
    }

    const whereClause = and(...conditions);

    const countRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.paymentOrders)
        .where(whereClause);
    const total = Number(countRes[0]?.count ?? 0);

    const sortDir = parsed.success && parsed.data.sortDir === 'asc' ? asc : desc;

    const rows = await db
        .select({
            orderId: schema.paymentOrders.orderId,
            planKey: schema.paymentOrders.planKey,
            billingMode: schema.paymentOrders.billingMode,
            priceAmountDecimal: schema.paymentOrders.expectedPriceAmountDecimal,
            priceCurrency: schema.paymentOrders.priceCurrency,
            payCurrency: schema.paymentOrders.payCurrency,
            internalStatus: schema.paymentOrders.internalStatus,
            providerStatus: schema.paymentOrders.providerStatus,
            entitlementGrantedAt: schema.paymentOrders.entitlementGrantedAt,
            createdAt: schema.paymentOrders.createdAt,
            updatedAt: schema.paymentOrders.updatedAt,
        })
        .from(schema.paymentOrders)
        .where(whereClause)
        .orderBy(sortDir(schema.paymentOrders.createdAt))
        .limit(pageSize)
        .offset(offset);

    const items = rows.map((r) => ({
        orderId: r.orderId,
        planKey: r.planKey,
        planName: resolvePlanDisplayName(r.planKey),
        billingMode: r.billingMode,
        priceAmountDecimal: r.priceAmountDecimal,
        priceCurrency: r.priceCurrency,
        payCurrency: r.payCurrency,
        internalStatus: r.internalStatus,
        providerStatus: r.providerStatus,
        entitlementGrantedAt: r.entitlementGrantedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
    }));

    return c.json({
        data: {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
    });
});

// ─── GET /payments/:orderId ───────────────────────────────────────────────────

accountRouter.get('/payments/:orderId', async (c) => {
    const customer = c.get('customer')!;
    const orderId = c.req.param('orderId');

    const db = createDB(c.env.DB);

    const order = await db
        .select({
            orderId: schema.paymentOrders.orderId,
            planKey: schema.paymentOrders.planKey,
            billingMode: schema.paymentOrders.billingMode,
            priceAmountDecimal: schema.paymentOrders.expectedPriceAmountDecimal,
            priceCurrency: schema.paymentOrders.priceCurrency,
            payCurrency: schema.paymentOrders.payCurrency,
            expectedPayAmountDecimal: schema.paymentOrders.expectedPayAmountDecimal,
            providerInvoiceId: schema.paymentOrders.providerInvoiceId,
            providerStatus: schema.paymentOrders.providerStatus,
            internalStatus: schema.paymentOrders.internalStatus,
            entitlementGrantedAt: schema.paymentOrders.entitlementGrantedAt,
            createdAt: schema.paymentOrders.createdAt,
            updatedAt: schema.paymentOrders.updatedAt,
        })
        .from(schema.paymentOrders)
        .where(
            and(
                eq(schema.paymentOrders.orderId, orderId),
                eq(schema.paymentOrders.userId, customer.userId),
            ),
        )
        .limit(1)
        .then((r) => r[0]);

    if (!order) {
        return c.json({ error: 'Order not found or unauthorized' }, 404);
    }

    // Check if there is an associated service entitlement
    const service = await db
        .select({
            id: schema.customerServices.id,
            serviceName: schema.customerServices.serviceName,
            status: schema.customerServices.status,
            startedAt: schema.customerServices.startedAt,
        })
        .from(schema.customerServices)
        .where(eq(schema.customerServices.orderId, orderId))
        .limit(1)
        .then((r) => r[0]);

    return c.json({
        data: {
            order: {
                ...order,
                planName: resolvePlanDisplayName(order.planKey),
            },
            service: service ?? null,
        },
    });
});

// ─── GET /deletion-eligibility ────────────────────────────────────────────────

accountRouter.get('/deletion-eligibility', async (c) => {
    const customer = c.get('customer')!;
    const db = createDB(c.env.DB);
    const eligibility = await checkCustomerDeletionEligibility(db, customer.userId);
    return c.json({ data: eligibility });
});

// ─── DELETE /me (Canonical Self-Service Account Deletion) ───────────────────────

accountRouter.delete('/me', async (c) => {
    const customer = c.get('customer')!;
    const db = createDB(c.env.DB);

    try {
        await deleteCustomerAccount(db, customer.userId);
        clearCustomerCookies(c, c.env.ENVIRONMENT === 'production');
        return c.json({ success: true, message: 'Your account has been deleted successfully.' });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Account deletion failed';
        console.error('[account/delete] Deletion error:', msg);
        return c.json({ error: msg, code: 'DELETION_FAILED' }, 400);
    }
});
