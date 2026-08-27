/**
 * Shared in-memory D1 database mock for Worker route tests.
 *
 * This is the single source of truth for test D1 behavior.
 * Import `createInMemoryDB` and `createMockKV` from here instead of
 * duplicating the implementation in individual test files.
 */

import { vi } from 'vitest';
import type * as schema from '../../../db/schema';

export interface MockStore {
    users: schema.UserRow[];
    userIdentities: schema.UserIdentityRow[];
    customerSessions: schema.CustomerSessionRow[];
    customerTokens: schema.CustomerTokenRow[];
    customerServices: schema.CustomerServiceRow[];
    paymentOrders: Record<string, unknown>[];
    paymentEvents: Record<string, unknown>[];
}

export function extractSelectedColumns(sql: string): string[] | null {
    const normalized = sql.replace(/\s+/g, ' ');
    const match = normalized.match(/select\s+(.+?)\s+from/i);
    if (!match || !match[1]) return null;
    const rawCols = match[1].trim();
    if (rawCols === '*') return null;
    return rawCols.split(',').map((c) => {
        const cleaned = c.replace(/["`]/g, '').trim();
        if (cleaned.toLowerCase().includes('count(')) return 'count';
        const colPart = cleaned.split(/\s+as\s+/i)[0]?.trim() ?? '';
        return colPart.split('.').pop() ?? '';
    });
}

export function parseInsertRow(sql: string, params: unknown[]): Record<string, unknown> {
    const colMatch = sql.match(/insert\s+into\s+[^(]+\(([\s\S]+?)\)\s+values/i);
    const valMatch = sql.match(/values\s*\(([\s\S]+?)\)/i);
    if (!colMatch || !colMatch[1] || !valMatch || !valMatch[1]) return {};

    const cols = colMatch[1].split(',').map((c) => c.replace(/["`]/g, '').trim());
    const valTokens = valMatch[1].split(',').map((v) => v.trim());

    const row: Record<string, unknown> = {};
    let paramIdx = 0;

    cols.forEach((col, idx) => {
        const token = valTokens[idx];
        let val: unknown = null;
        if (token === '?') {
            val = params[paramIdx++];
        } else if (token === 'null' || token === 'NULL') {
            val = null;
        } else {
            val = token;
        }
        row[col] = val;
        const camel = col.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
        row[camel] = val;
    });

    return row;
}

export function createInMemoryDB(): { db: D1Database; store: MockStore } {
    const store: MockStore = {
        users: [],
        userIdentities: [],
        customerSessions: [],
        customerTokens: [],
        customerServices: [],
        paymentOrders: [],
        paymentEvents: [],
    };

    const mockD1: D1Database = {
        prepare(query: string) {
            let boundParams: unknown[] = [];
            const stmt = {
                bind(...params: unknown[]) {
                    boundParams = params;
                    return stmt;
                },
                async first<T = unknown>(col?: string): Promise<T | null> {
                    const res = await stmt.all();
                    const firstRow = res.results?.[0] as Record<string, unknown> | undefined;
                    if (!firstRow) return null;
                    if (col) return (firstRow[col] as T) ?? null;
                    return firstRow as T;
                },
                async raw() {
                    const res = await stmt.all();
                    const cols = extractSelectedColumns(query);
                    if (cols && cols.length > 0) {
                        const mapped = res.results.map((r) => {
                            const row = r as Record<string, unknown>;
                            return cols.map((col) => {
                                const camelCol = col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
                                const snakeCol = col.replace(/([A-Z])/g, '_$1').toLowerCase();
                                return row[col] ?? row[camelCol] ?? row[snakeCol] ?? null;
                            });
                        });
                        return mapped;
                    }
                    return res.results.map((r) => Object.values(r as Record<string, unknown>));
                },
                async run() {
                    const qLower = query.toLowerCase();
                    const now = new Date().toISOString();

                    if (qLower.includes('insert into') && qLower.includes('users')) {
                        const row = parseInsertRow(query, boundParams);
                        if (!row.createdAt) row.createdAt = now;
                        if (!row.updatedAt) row.updatedAt = now;
                        store.users.push(row as unknown as schema.UserRow);
                        return { success: true, meta: { changes: 1 } };
                    }

                    if (qLower.includes('insert into') && qLower.includes('user_identities')) {
                        const row = parseInsertRow(query, boundParams);
                        store.userIdentities.push(row as unknown as schema.UserIdentityRow);
                        return { success: true, meta: { changes: 1 } };
                    }

                    if (qLower.includes('insert into') && qLower.includes('customer_sessions')) {
                        const row = parseInsertRow(query, boundParams);
                        store.customerSessions.push(row as unknown as schema.CustomerSessionRow);
                        return { success: true, meta: { changes: 1 } };
                    }

                    if (qLower.includes('insert into') && qLower.includes('customer_services')) {
                        const row = parseInsertRow(query, boundParams);
                        if (store.customerServices.some((s) => s.orderId === (row.orderId || row.order_id))) {
                            throw new Error('UNIQUE constraint failed: customer_services.order_id');
                        }
                        store.customerServices.push(row as unknown as schema.CustomerServiceRow);
                        return { success: true, meta: { changes: 1 } };
                    }

                    if (qLower.includes('insert into') && qLower.includes('payment_orders')) {
                        const row = parseInsertRow(query, boundParams);
                        store.paymentOrders.push(row);
                        return { success: true, meta: { changes: 1 } };
                    }

                    if (qLower.includes('update') && qLower.includes('customer_sessions')) {
                        if (qLower.includes('set "revoked_at"')) {
                            const revokedAt = boundParams[0] as string;
                            const hash = boundParams[1] as string | undefined;
                            const userId = boundParams.find((p) => typeof p === 'string' && p.startsWith('usr_')) as string | undefined;
                            store.customerSessions.forEach((s) => {
                                if (hash && s.sessionTokenHash === hash) s.revokedAt = revokedAt;
                                if (userId && s.userId === userId && !s.revokedAt) s.revokedAt = revokedAt;
                            });
                        }
                        return { success: true, meta: { changes: 1 } };
                    }

                    if (qLower.includes('insert into') && qLower.includes('customer_tokens')) {
                        const row = parseInsertRow(query, boundParams);
                        if (!row.id) row.id = store.customerTokens.length + 1;
                        store.customerTokens.push(row as unknown as schema.CustomerTokenRow);
                        return { success: true, meta: { changes: 1 } };
                    }

                    if (qLower.includes('update') && qLower.includes('customer_tokens')) {
                        if (qLower.includes('set "consumed_at"')) {
                            const consumedAt = boundParams[0] as string;
                            const id = boundParams.find((p) => typeof p === 'number') as number | undefined;
                            const userId = boundParams.find((p) => typeof p === 'string' && p.startsWith('usr_')) as string | undefined;
                            store.customerTokens.forEach((t) => {
                                if (id && t.id === id) t.consumedAt = consumedAt;
                                if (userId && t.userId === userId && (!t.consumedAt || t.consumedAt === null)) t.consumedAt = consumedAt;
                            });
                        }
                        return { success: true, meta: { changes: 1 } };
                    }

                    if (qLower.includes('delete from') && qLower.includes('user_identities')) {
                        const userId = boundParams.find((p) => typeof p === 'string' && p.startsWith('usr_')) as string | undefined;
                        if (userId) {
                            store.userIdentities = store.userIdentities.filter((i) => i.userId !== userId);
                        }
                        return { success: true, meta: { changes: 1 } };
                    }

                    if (qLower.includes('update') && qLower.includes('users')) {
                        const userId = boundParams.find((p) => typeof p === 'string' && p.startsWith('usr_')) as string | undefined;
                        const user = store.users.find((u) => u.id === userId);
                        if (user) {
                            if (qLower.includes('"email_verified"')) {
                                user.emailVerified = true;
                                user.emailVerifiedAt = new Date().toISOString();
                            }
                            if (qLower.includes('"disabled_at"')) {
                                const disabledParam = boundParams.find((p) => typeof p === 'string' && (p.includes('T') || p.includes('Z') || p.includes('-')));
                                if (disabledParam) user.disabledAt = disabledParam as string;
                            }
                            if (qLower.includes('"token_version"')) {
                                user.tokenVersion = (user.tokenVersion || 1) + 1;
                            }
                            if (qLower.includes('"display_name"')) {
                                const nameParam = boundParams.find((p) => typeof p === 'string' && !p.startsWith('usr_') && !p.includes('@') && !p.includes(':'));
                                if (nameParam) user.displayName = nameParam as string;
                            }
                            if (qLower.includes('"email"') && qLower.includes('deleted_')) {
                                const tombstone = boundParams.find((p) => typeof p === 'string' && p.includes('@dreamwebapp.internal'));
                                if (tombstone) user.email = tombstone as string;
                            }
                        }
                        return { success: true, meta: { changes: 1 } };
                    }

                    if (qLower.includes('select name from sqlite_master')) {
                        return {
                            results: [
                                { name: 'users' },
                                { name: 'user_identities' },
                                { name: 'customer_sessions' },
                                { name: 'customer_tokens' },
                                { name: 'customer_services' },
                                { name: 'payment_orders' },
                                { name: 'payment_events' },
                                { name: 'admin_users' },
                                { name: 'services' },
                                { name: 'solutions' },
                                { name: 'pricing_plans' },
                                { name: 'pricing_addons' },
                                { name: 'faq_items' },
                                { name: 'site_settings' },
                            ],
                            success: true,
                            meta: { changes: 0, duration: 0, last_row_id: 0, rows_read: 0, rows_written: 0, served_by: 'mock', size_after: 0 },
                        };
                    }

                    return { success: true, meta: { changes: 1, duration: 0, last_row_id: 0, rows_read: 0, rows_written: 0, served_by: 'mock', size_after: 0 } };
                },
                async all() {
                    const qLower = query.toLowerCase();

                    if (qLower.includes('insert into') && qLower.includes('payment_orders')) {
                        const row = parseInsertRow(query, boundParams);
                        store.paymentOrders.push(row);
                        return { results: [row], success: true, meta: { changes: 1 } };
                    }

                    if (qLower.includes('select name from sqlite_master')) {
                        return {
                            results: [
                                { name: 'users' }, { name: 'user_identities' }, { name: 'customer_sessions' },
                                { name: 'customer_tokens' }, { name: 'customer_services' }, { name: 'payment_orders' },
                                { name: 'payment_events' }, { name: 'admin_users' }, { name: 'services' },
                                { name: 'solutions' }, { name: 'pricing_plans' }, { name: 'pricing_addons' },
                                { name: 'faq_items' }, { name: 'site_settings' },
                            ],
                            success: true,
                            meta: { changes: 0, duration: 0, last_row_id: 0, rows_read: 0, rows_written: 0, served_by: 'mock', size_after: 0 },
                        };
                    }

                    if (qLower.includes('from "users"')) {
                        const emailParam = boundParams.find((p) => typeof p === 'string' && p.includes('@'));
                        const idParam = boundParams.find((p) => typeof p === 'string' && p.startsWith('usr_'));

                        if (qLower.includes('count(')) {
                            return { results: [{ count: store.users.length }], success: true, meta: {} };
                        }
                        if (emailParam) {
                            const match = store.users.find((u) => u.email === (emailParam as string).toLowerCase());
                            return { results: match ? [match] : [], success: true, meta: {} };
                        }
                        if (idParam) {
                            const match = store.users.find((u) => u.id === idParam);
                            return { results: match ? [match] : [], success: true, meta: {} };
                        }
                        return { results: store.users, success: true, meta: {} };
                    }

                    if (qLower.includes('from "customer_sessions"')) {
                        const hashParam = boundParams.find((p) => typeof p === 'string' && p.length === 64);
                        const userIdParam = boundParams.find((p) => typeof p === 'string' && p.startsWith('usr_'));

                        let items = store.customerSessions;
                        if (hashParam) {
                            items = items.filter((s) => s.sessionTokenHash === hashParam && !s.revokedAt);
                        }
                        if (userIdParam) {
                            items = items.filter((s) => s.userId === userIdParam);
                        }
                        if (qLower.includes('count(')) {
                            return { results: [{ count: items.length }], success: true, meta: {} };
                        }
                        return { results: items, success: true, meta: {} };
                    }

                    if (qLower.includes('from "user_identities"')) {
                        const userIdParam = boundParams.find((p) => typeof p === 'string' && p.startsWith('usr_'));
                        let items = store.userIdentities;
                        if (userIdParam) {
                            items = items.filter((i) => i.userId === userIdParam);
                        }
                        return { results: items, success: true, meta: {} };
                    }

                    if (qLower.includes('from "customer_services"')) {
                        const userIdParam = boundParams.find((p) => typeof p === 'string' && p.startsWith('usr_'));
                        const serviceIdParam = boundParams.find((p) => typeof p === 'string' && p.startsWith('srv_'));

                        let items = store.customerServices;
                        if (userIdParam) { items = items.filter((s) => s.userId === userIdParam); }
                        if (serviceIdParam) { items = items.filter((s) => s.id === serviceIdParam); }
                        if (qLower.includes('count(')) {
                            return { results: [{ count: items.length }], success: true, meta: {} };
                        }
                        return { results: items, success: true, meta: {} };
                    }

                    if (qLower.includes('from "payment_orders"')) {
                        const userIdParam = boundParams.find((p) => typeof p === 'string' && p.startsWith('usr_'));
                        const orderIdParam = boundParams.find((p) => typeof p === 'string' && p.startsWith('order_'));

                        let items = store.paymentOrders;
                        if (userIdParam) { items = items.filter((o) => o.userId === userIdParam); }
                        if (orderIdParam) { items = items.filter((o) => o.orderId === orderIdParam); }
                        if (qLower.includes('count(')) {
                            return { results: [{ count: items.length }], success: true, meta: {} };
                        }
                        return { results: items, success: true, meta: {} };
                    }

                    if (qLower.includes('from "customer_tokens"')) {
                        const hashParam = boundParams.find((p) => typeof p === 'string' && p.length === 64);
                        const userIdParam = boundParams.find((p) => typeof p === 'string' && p.startsWith('usr_'));
                        let items = store.customerTokens;
                        if (hashParam) {
                            items = items.filter((t) => t.tokenHash === hashParam && !t.consumedAt);
                        }
                        if (userIdParam) {
                            items = items.filter((t) => t.userId === userIdParam);
                        }
                        if (qLower.includes('count(')) {
                            return { results: [{ count: items.length }], success: true, meta: {} };
                        }
                        return { results: items, success: true, meta: {} };
                    }

                    return { results: [], success: true, meta: {} };
                },
            };
            return stmt as unknown as D1PreparedStatement;
        },
        batch: vi.fn(),
        dump: vi.fn(),
        exec: vi.fn(),
        withSession: vi.fn(),
    } as unknown as D1Database;

    return { db: mockD1, store };
}

export function createMockKV(): KVNamespace {
    const kvStore = new Map<string, string>();
    return {
        get: vi.fn(async (key: string) => kvStore.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => { kvStore.set(key, value); }),
        delete: vi.fn(async (key: string) => { kvStore.delete(key); }),
        list: vi.fn(),
        getWithMetadata: vi.fn(),
    } as unknown as KVNamespace;
}
