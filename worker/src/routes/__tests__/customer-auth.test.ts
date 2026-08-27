import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../index';
import type { Env } from '../../types/env';
import {
    registerCustomerWithPassword,
    loginCustomerWithPassword,
    validateCustomerSession,
    revokeCustomerSession,
    sha256Hex,
    startOAuthFlow,
    checkCustomerDeletionEligibility,
} from '../../lib/customer-auth-service';
import { signJWT } from '../../middleware/auth';
import { createDB } from '../../db';
import * as schema from '../../db/schema';
import type { MockStore } from './helpers/d1-mock';
import { createInMemoryDB, createMockKV } from './helpers/d1-mock';







function createTestEnv(mockD1: D1Database, mockKV: KVNamespace): Env {
    return {
        DB: mockD1,
        CONTENT_KV: mockKV,
        LOGO_ASSETS: {} as R2Bucket,
        AI: {} as Ai,
        JWT_SECRET: 'test-admin-secret-which-is-at-least-32-chars-long!',
        CORS_ORIGIN: 'https://dreamwebapp.com,https://www.dreamwebapp.com,http://localhost:5173',
        ENVIRONMENT: 'development',
        RESEND_API_KEY: 'test-resend-api-key',
        RESEND_FROM_EMAIL: 'no-reply@dreamwebapp.com',
        CUSTOMER_AUTH_GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
        CUSTOMER_AUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret',
        CUSTOMER_AUTH_X_CLIENT_ID: 'x-client-id',
        CUSTOMER_AUTH_X_CLIENT_SECRET: 'x-client-secret',
    };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Customer Authentication & Account Subsystem', () => {
    let mockD1: D1Database;
    let mockKV: KVNamespace;
    let store: MockStore;
    let env: Env;

    beforeEach(() => {
        const mem = createInMemoryDB();
        mockD1 = mem.db;
        store = mem.store;
        mockKV = createMockKV();
        env = createTestEnv(mockD1, mockKV);
    });

    describe('1. Password Registration & Security', () => {
        it('registers a new customer with PBKDF2 password hashing', async () => {
            const drizzle = createDB(mockD1);
            const result = await registerCustomerWithPassword(drizzle, {
                email: 'customer@example.com',
                password: 'SecurePassword123!',
                displayName: 'Alice Explorer',
            });

            expect(result.user.id).toMatch(/^usr_/);
            expect(result.user.email).toBe('customer@example.com');
            expect(result.user.displayName).toBe('Alice Explorer');
            expect(result.user.emailVerified).toBe(false);
            expect(result.sessionToken).toBeDefined();
            expect(result.csrfToken).toBeDefined();
            expect(result.verificationRawToken).toBeDefined();

            // Verify stored in DB with PBKDF2 hash, not plaintext
            const stored = store.users.find((u) => u.email === 'customer@example.com');
            expect(stored).toBeDefined();
            expect(stored?.passwordHash).toMatch(/^pbkdf2:100000:/);
            expect(stored?.passwordHash).not.toContain('SecurePassword123!');
            expect(result.user.id).toMatch(/^usr_/);
        });

        it('prevents duplicate registration for an existing email', async () => {
            const drizzle = createDB(mockD1);
            await registerCustomerWithPassword(drizzle, {
                email: 'duplicate@example.com',
                password: 'Password123!',
            });

            await expect(
                registerCustomerWithPassword(drizzle, {
                    email: 'duplicate@example.com',
                    password: 'AnotherPassword456!',
                }),
            ).rejects.toThrow('already exists');
        });

        it('returns client-safe 409 error on duplicate email via HTTP endpoint', async () => {
            const drizzle = createDB(mockD1);
            await registerCustomerWithPassword(drizzle, {
                email: 'http-dup@example.com',
                password: 'Password123!',
            });

            const req = new Request('http://localhost/api/v1/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'http-dup@example.com',
                    password: 'AnotherPassword456!',
                }),
            });
            const res = await app.fetch(req, env);
            expect(res.status).toBe(409);
            const json = (await res.json()) as { error: string };
            expect(json.error).toContain('already exists');
        });

        it('returns client-safe 422 error on invalid registration payload', async () => {
            const req = new Request('http://localhost/api/v1/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'not-an-email',
                    password: 'short',
                }),
            });
            const res = await app.fetch(req, env);
            expect(res.status).toBe(422);
            const json = (await res.json()) as { error: string; fields: Record<string, string[]> };
            expect(json.error).toBe('Validation failed');
            expect(json.fields?.email).toBeDefined();
            expect(json.fields?.password).toBeDefined();
        });
    });

    describe('2. Password Login & Session Lifecycle', () => {
        it('logs in with correct credentials and returns session', async () => {
            const drizzle = createDB(mockD1);
            await registerCustomerWithPassword(drizzle, {
                email: 'login-test@example.com',
                password: 'CorrectPassword123!',
            });

            const loginRes = await loginCustomerWithPassword(drizzle, {
                email: 'login-test@example.com',
                password: 'CorrectPassword123!',
            });

            expect(loginRes.user.email).toBe('login-test@example.com');
            expect(loginRes.sessionToken).toBeDefined();

            // Validate session in D1
            const sessionCheck = await validateCustomerSession(drizzle, loginRes.sessionToken);
            expect(sessionCheck).not.toBeNull();
            expect(sessionCheck?.user.email).toBe('login-test@example.com');
        });

        it('rejects invalid password', async () => {
            const drizzle = createDB(mockD1);
            await registerCustomerWithPassword(drizzle, {
                email: 'wrong-pw@example.com',
                password: 'CorrectPassword123!',
            });

            await expect(
                loginCustomerWithPassword(drizzle, {
                    email: 'wrong-pw@example.com',
                    password: 'WrongPassword!',
                }),
            ).rejects.toThrow('Invalid email or password');
        });

        it('revokes session on logout', async () => {
            const drizzle = createDB(mockD1);
            const reg = await registerCustomerWithPassword(drizzle, {
                email: 'logout-test@example.com',
                password: 'Password123!',
            });

            const validBefore = await validateCustomerSession(drizzle, reg.sessionToken);
            expect(validBefore).not.toBeNull();

            await revokeCustomerSession(drizzle, reg.sessionToken);

            const validAfter = await validateCustomerSession(drizzle, reg.sessionToken);
            expect(validAfter).toBeNull();
        });
    });

    describe('3. Capabilities Endpoint', () => {
        it('returns provider availability flags without leaking secrets', async () => {
            const req = new Request('http://localhost/api/v1/auth/capabilities', { method: 'GET' });
            const res = await app.fetch(req, env);

            expect(res.status).toBe(200);
            const body = (await res.json()) as { data: { google: boolean; x: boolean; emailAuth: boolean } };
            expect(body.data).toEqual({
                google: true,
                x: true,
                emailAuth: true,
            });
            // Ensure no secrets leaked
            const bodyStr = JSON.stringify(body);
            expect(bodyStr).not.toContain('google-client-secret');
            expect(bodyStr).not.toContain('x-client-secret');
        });
    });

    describe('4. Principal Isolation & Route Guards', () => {
        it('rejects customer tokens on admin routes', async () => {
            // Sign a customer JWT
            const customerToken = await signJWT(
                { sub: 'usr_customer_123', email: 'customer@example.com', role: 'customer' as unknown as string, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 },
                env.JWT_SECRET,
            );

            const req = new Request('http://localhost/api/v1/admin/payments/summary', {
                method: 'GET',
                headers: { Authorization: `Bearer ${customerToken}` },
            });
            const res = await app.fetch(req, env);

            // Must be 403 Forbidden because role is not super_admin/editor
            expect(res.status).toBe(403);
        });

        it('rejects admin tokens on customer account routes', async () => {
            // Sign an admin JWT
            const adminToken = await signJWT(
                { sub: '1', email: 'admin@dreamwebapp.com', role: 'super_admin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 },
                env.JWT_SECRET,
            );

            const req = new Request('http://localhost/api/v1/account/services', {
                method: 'GET',
                headers: { Authorization: `Bearer ${adminToken}` },
            });
            const res = await app.fetch(req, env);

            // Must be 401 Unauthorized because customer routes require dreamwebapp_session cookie
            expect(res.status).toBe(401);
        });
    });

    describe('5. OAuth PKCE Flow Initiation', () => {
        it('starts Google OAuth flow with PKCE verifier stored in KV', async () => {
            const { authUrl, state } = await startOAuthFlow(env, 'google', '/account');
            expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
            expect(authUrl).toContain('code_challenge_method=S256');
            expect(authUrl).toContain(`state=${state}`);

            const stateHash = await sha256Hex(state);
            const kvVal = await env.CONTENT_KV.get(`oauth:state:${stateHash}`);
            expect(kvVal).not.toBeNull();
            const parsed = JSON.parse(kvVal!);
            expect(parsed.provider).toBe('google');
            expect(parsed.codeVerifier).toBeDefined();
            expect(parsed.returnTo).toBe('/account');
        });
    });

    describe('6. Data Isolation between Customers', () => {
        it('ensures Customer A cannot view Customer B services', async () => {
            const drizzle = createDB(mockD1);
            const custA = await registerCustomerWithPassword(drizzle, {
                email: 'customer-a@example.com',
                password: 'Password123!',
            });
            const custB = await registerCustomerWithPassword(drizzle, {
                email: 'customer-b@example.com',
                password: 'Password123!',
            });

            // Grant service to Customer A
            await drizzle.insert(schema.customerServices).values({
                id: 'srv_cust_a_1',
                userId: custA.user.id,
                orderId: 'order_uuid_a',
                planKey: 'starter-bot',
                serviceName: 'Starter Bot AI Automation',
                status: 'active',
                startedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            // Request with Customer B's session cookie
            const req = new Request('http://localhost/api/v1/account/services/srv_cust_a_1', {
                method: 'GET',
                headers: {
                    Cookie: `dreamwebapp_session=${encodeURIComponent(custB.sessionToken)}`,
                },
            });
            const res = await app.fetch(req, env);

            // Must return 404 (Not found or unauthorized)
            expect(res.status).toBe(404);
        });
    });

    describe('7. CSRF Protection on State-Changing Endpoints', () => {
        it('rejects state-changing requests when CSRF token is missing or mismatched', async () => {
            const drizzle = createDB(mockD1);
            const cust = await registerCustomerWithPassword(drizzle, {
                email: 'csrf-test@example.com',
                password: 'Password123!',
            });

            // Request without X-CSRF-Token header
            const reqNoCsrf = new Request('http://localhost/api/v1/auth/me', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Origin: 'https://dreamwebapp.com',
                    Cookie: `dreamwebapp_session=${encodeURIComponent(cust.sessionToken)}; dreamwebapp_csrf=${encodeURIComponent(cust.csrfToken)}`,
                },
                body: JSON.stringify({ displayName: 'New Name' }),
            });
            const resNoCsrf = await app.fetch(reqNoCsrf, env);
            expect(resNoCsrf.status).toBe(403);

            // Request with invalid X-CSRF-Token header
            const reqWrongCsrf = new Request('http://localhost/api/v1/auth/me', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Origin: 'https://dreamwebapp.com',
                    'X-CSRF-Token': 'wrong-csrf-token-value',
                    Cookie: `dreamwebapp_session=${encodeURIComponent(cust.sessionToken)}; dreamwebapp_csrf=${encodeURIComponent(cust.csrfToken)}`,
                },
                body: JSON.stringify({ displayName: 'New Name' }),
            });
            const resWrongCsrf = await app.fetch(reqWrongCsrf, env);
            expect(resWrongCsrf.status).toBe(403);

            // Request with matching X-CSRF-Token header
            const reqValidCsrf = new Request('http://localhost/api/v1/auth/me', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Origin: 'https://dreamwebapp.com',
                    'X-CSRF-Token': cust.csrfToken,
                    Cookie: `dreamwebapp_session=${encodeURIComponent(cust.sessionToken)}; dreamwebapp_csrf=${encodeURIComponent(cust.csrfToken)}`,
                },
                body: JSON.stringify({ displayName: 'Valid Updated Name' }),
            });
            const resValidCsrf = await app.fetch(reqValidCsrf, env);
            expect(resValidCsrf.status).toBe(200);
        });
    });

    describe('8. Admin Customer Management & Observability', () => {
        it('returns paginated customer list for authenticated admin without exposing password hashes', async () => {
            const drizzle = createDB(mockD1);
            await registerCustomerWithPassword(drizzle, {
                email: 'admin-list-cust@example.com',
                password: 'Password123!',
                displayName: 'List Customer',
            });

            const adminToken = await signJWT(
                { sub: '1', email: 'admin@dreamwebapp.com', role: 'super_admin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 },
                env.JWT_SECRET,
            );

            const req = new Request('http://localhost/api/v1/admin/customers?page=1&pageSize=10', {
                method: 'GET',
                headers: { Authorization: `Bearer ${adminToken}` },
            });
            const res = await app.fetch(req, env);

            expect(res.status).toBe(200);
            const json = (await res.json()) as { data: { items: Array<{ id: string; email: string; passwordHash?: string }> } };
            expect(json.data.items.length).toBeGreaterThan(0);
            expect(json.data.items[0]?.email).toBe('admin-list-cust@example.com');
            // Ensure no password hashes returned
            expect(json.data.items[0]?.passwordHash).toBeUndefined();
            const bodyStr = JSON.stringify(json);
            expect(bodyStr).not.toContain('password_hash');
            expect(bodyStr).not.toContain('passwordHash');
        });

        it('disables customer account and revokes active sessions', async () => {
            const drizzle = createDB(mockD1);
            const cust = await registerCustomerWithPassword(drizzle, {
                email: 'disable-me@example.com',
                password: 'Password123!',
            });

            const adminToken = await signJWT(
                { sub: '1', email: 'admin@dreamwebapp.com', role: 'super_admin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 },
                env.JWT_SECRET,
            );

            // Admin disables customer
            const reqDisable = new Request(`http://localhost/api/v1/admin/customers/${cust.user.id}/disable`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${adminToken}` },
            });
            const resDisable = await app.fetch(reqDisable, env);
            expect(resDisable.status).toBe(200);

            // Disabled customer session is now invalid
            const sessionCheck = await validateCustomerSession(drizzle, cust.sessionToken);
            expect(sessionCheck).toBeNull();

            // Disabled customer cannot log in
            await expect(
                loginCustomerWithPassword(drizzle, {
                    email: 'disable-me@example.com',
                    password: 'Password123!',
                }),
            ).rejects.toThrow('disabled');
        });

        it('rejects customer token on admin customer management endpoints', async () => {
            const customerToken = await signJWT(
                { sub: 'usr_fake_customer', email: 'cust@example.com', role: 'customer' as unknown as string, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 },
                env.JWT_SECRET,
            );

            const req = new Request('http://localhost/api/v1/admin/customers', {
                method: 'GET',
                headers: { Authorization: `Bearer ${customerToken}` },
            });
            const res = await app.fetch(req, env);
            expect(res.status).toBe(403);
        });
    });

    describe('9. Operational Schema Health Check', () => {
        it('verifies all required tables exist in D1 database', async () => {
            const adminToken = await signJWT(
                { sub: '1', email: 'admin@dreamwebapp.com', role: 'super_admin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 },
                env.JWT_SECRET,
            );

            const req = new Request('http://localhost/api/v1/admin/health/schema', {
                method: 'GET',
                headers: { Authorization: `Bearer ${adminToken}` },
            });
            const res = await app.fetch(req, env);
            expect(res.status).toBe(200);
            const json = (await res.json()) as { data: { ok: boolean; tables: Record<string, boolean> } };
            expect(json.data.ok).toBe(true);
            expect(json.data.tables.users).toBe(true);
            expect(json.data.tables.user_identities).toBe(true);
            expect(json.data.tables.customer_sessions).toBe(true);
            expect(json.data.tables.customer_services).toBe(true);
            expect(json.data.tables.payment_orders).toBe(true);
        });
    });

    describe('10. Customer Email Verification Flow', () => {
        it('consumes a single-use verification token and marks user.emailVerified = true', async () => {
            const drizzle = createDB(mockD1);
            const reg = await registerCustomerWithPassword(drizzle, {
                email: 'verify-me@example.com',
                password: 'Password123!',
            });

            expect(reg.user.emailVerified).toBe(false);
            expect(reg.verificationRawToken).toBeDefined();

            // Verify via HTTP endpoint
            const req = new Request('http://localhost/api/v1/auth/email-verification/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: reg.verificationRawToken }),
            });
            const res = await app.fetch(req, env);
            expect(res.status).toBe(200);
            const json = (await res.json()) as { success: boolean; message: string };
            expect(json.success).toBe(true);

            // Verify user record in D1 is now verified
            const updatedUser = store.users.find((u) => u.id === reg.user.id);
            expect(updatedUser?.emailVerified).toBe(true);

            // Token replay fails safely
            const reqReplay = new Request('http://localhost/api/v1/auth/email-verification/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: reg.verificationRawToken }),
            });
            const resReplay = await app.fetch(reqReplay, env);
            expect(resReplay.status).toBe(400);
        });

        it('supports authenticated email verification resend', async () => {
            const originalFetch = globalThis.fetch;
            globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
                const url = typeof input === 'string' ? input : input.toString();
                if (url.includes('api.resend.com')) {
                    return new Response(JSON.stringify({ id: 'mock_resend_id' }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                return originalFetch(input, init);
            };

            try {
                const drizzle = createDB(mockD1);
                const reg = await registerCustomerWithPassword(drizzle, {
                    email: 'resend-test@example.com',
                    password: 'Password123!',
                });

                const req = new Request('http://localhost/api/v1/auth/email-verification/resend', {
                    method: 'POST',
                    headers: {
                        Cookie: `dreamwebapp_session=${encodeURIComponent(reg.sessionToken)}; dreamwebapp_csrf=${encodeURIComponent(reg.csrfToken)}`,
                        'X-CSRF-Token': reg.csrfToken,
                        Origin: 'https://dreamwebapp.com',
                    },
                });
                const res = await app.fetch(req, env);
                expect(res.status).toBe(200);
                const json = (await res.json()) as { success: boolean };
                expect(json.success).toBe(true);
            } finally {
                globalThis.fetch = originalFetch;
            }
        });
    });

    describe('11. Customer Self-Service Account Deletion Flow', () => {
        it('allows account deletion when customer has no active services and no paid orders', async () => {
            const drizzle = createDB(mockD1);
            const reg = await registerCustomerWithPassword(drizzle, {
                email: 'delete-ok@example.com',
                password: 'Password123!',
            });

            // Check eligibility endpoint
            const reqCheck = new Request('http://localhost/api/v1/account/deletion-eligibility', {
                method: 'GET',
                headers: {
                    Cookie: `dreamwebapp_session=${encodeURIComponent(reg.sessionToken)}`,
                },
            });
            const resCheck = await app.fetch(reqCheck, env);
            expect(resCheck.status).toBe(200);
            const jsonCheck = (await resCheck.json()) as { data: { eligible: boolean } };
            expect(jsonCheck.data.eligible).toBe(true);

            // Execute deletion
            const reqDelete = new Request('http://localhost/api/v1/account/me', {
                method: 'DELETE',
                headers: {
                    Cookie: `dreamwebapp_session=${encodeURIComponent(reg.sessionToken)}; dreamwebapp_csrf=${encodeURIComponent(reg.csrfToken)}`,
                    'X-CSRF-Token': reg.csrfToken,
                    Origin: 'https://dreamwebapp.com',
                },
            });
            const resDelete = await app.fetch(reqDelete, env);
            expect(resDelete.status).toBe(200);

            // Subsequent session check fails
            const sessionCheck = await validateCustomerSession(drizzle, reg.sessionToken);
            expect(sessionCheck).toBeNull();

            // Subsequent login fails
            await expect(
                loginCustomerWithPassword(drizzle, {
                    email: 'delete-ok@example.com',
                    password: 'Password123!',
                }),
            ).rejects.toThrow();
        });

        it('blocks account deletion when customer has an active service entitlement', async () => {
            const drizzle = createDB(mockD1);
            const reg = await registerCustomerWithPassword(drizzle, {
                email: 'has-service@example.com',
                password: 'Password123!',
            });

            // Add active customer service
            store.customerServices.push({
                id: 'srv_test_active',
                userId: reg.user.id,
                orderId: 'order_test_1',
                planKey: 'starter-bot',
                serviceName: 'Starter Bot AI',
                status: 'active',
                expiresAt: null,
                nextReviewAt: null,
                startedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            // Eligibility check is blocked
            const check = await checkCustomerDeletionEligibility(drizzle, reg.user.id);
            expect(check.eligible).toBe(false);
            if (!check.eligible) {
                expect(check.reason).toBe('blocked_active_service');
            }

            // Attempting DELETE fails with 400
            const reqDelete = new Request('http://localhost/api/v1/account/me', {
                method: 'DELETE',
                headers: {
                    Cookie: `dreamwebapp_session=${encodeURIComponent(reg.sessionToken)}; dreamwebapp_csrf=${encodeURIComponent(reg.csrfToken)}`,
                    'X-CSRF-Token': reg.csrfToken,
                    Origin: 'https://dreamwebapp.com',
                },
            });
            const resDelete = await app.fetch(reqDelete, env);
            expect(resDelete.status).toBe(400);
        });

        it('blocks account deletion when customer has purchased/paid payment order history', async () => {
            const drizzle = createDB(mockD1);
            const reg = await registerCustomerWithPassword(drizzle, {
                email: 'has-paid-order@example.com',
                password: 'Password123!',
            });

            // Add paid payment order
            store.paymentOrders.push({
                orderId: 'order_paid_123',
                userId: reg.user.id,
                planKey: 'business-pro',
                internalStatus: 'paid',
                entitlementGrantedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            });

            // Eligibility check is blocked
            const check = await checkCustomerDeletionEligibility(drizzle, reg.user.id);
            expect(check.eligible).toBe(false);
            if (!check.eligible) {
                expect(check.reason).toBe('blocked_paid_order_history');
            }
        });
    });

    describe('12. OAuth Flow and Canonical Frontend Redirects', () => {
        it('redirects OAuth errors to canonical frontend app origin /login', async () => {
            const res = await app.request('/api/v1/auth/oauth/google/callback?error=access_denied&error_description=User+denied', {
                method: 'GET',
            }, env);

            expect(res.status).toBe(302);
            const location = res.headers.get('Location');
            expect(location).toBe('https://dreamwebapp.com/login?error=Sign%20in%20was%20cancelled%20or%20denied%20by%20provider.');
        });

        it('redirects missing code/state to canonical frontend app origin /login', async () => {
            const res = await app.request('/api/v1/auth/oauth/google/callback', {
                method: 'GET',
            }, env);

            expect(res.status).toBe(302);
            const location = res.headers.get('Location');
            expect(location).toBe('https://dreamwebapp.com/login?error=Missing%20authorization%20code%20or%20state.');
        });
    });
});


