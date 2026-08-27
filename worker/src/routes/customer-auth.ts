/**
 * Customer authentication routes — mounted at /api/v1/auth
 *
 *   GET  /capabilities                -> provider availability booleans
 *   POST /register                    -> email/password registration + cookie session
 *   POST /login                       -> email/password login + cookie session
 *   POST /logout                      -> revoke session + clear cookies
 *   GET  /me                          -> current customer profile
 *   PUT  /me                          -> update customer profile
 *   GET  /oauth/:provider/start       -> begin PKCE OAuth flow (Google/X)
 *   GET  /oauth/:provider/callback    -> complete PKCE OAuth flow and set cookie
 *   POST /password-reset/request      -> request password reset token
 *   POST /password-reset/confirm      -> confirm password reset
 */

import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import type { Env } from '../types/env';
import { createDB } from '../db';
import * as schema from '../db/schema';
import { rateLimiter } from '../middleware/ratelimit';
import {
    customerAuthMiddleware,
    setCustomerCookies,
    clearCustomerCookies,
    getCookie,
    SESSION_COOKIE_NAME,
    type CustomerHonoVariables,
} from '../middleware/customer-auth';
import {
    CustomerRegisterSchema,
    CustomerLoginSchema,
    CustomerUpdateProfileSchema,
    CustomerPasswordResetRequestSchema,
    CustomerPasswordResetConfirmSchema,
    CustomerEmailVerificationConfirmSchema,
} from '../validators/schemas';
import {
    registerCustomerWithPassword,
    loginCustomerWithPassword,
    revokeCustomerSession,
    revokeAllCustomerSessions,
    getAuthCapabilities,
    startOAuthFlow,
    handleOAuthCallback,
    toSafeUserDto,
    generateRandomToken,
    sha256Hex,
    sanitizeReturnTo,
    confirmEmailVerification,
    createEmailVerificationToken,
    getCanonicalAppOrigin,
} from '../lib/customer-auth-service';
import { sendCustomerVerificationEmail } from '../lib/email-provider';
import { hashPassword } from '../middleware/auth';

export const customerAuthRouter = new Hono<{ Bindings: Env; Variables: CustomerHonoVariables }>();

// ─── Rate Limiters ────────────────────────────────────────────────────────────

customerAuthRouter.use('/register', rateLimiter(10, 60 * 1000, 'rl:auth:register'));
customerAuthRouter.use('/login', rateLimiter(10, 60 * 1000, 'rl:auth:login'));
customerAuthRouter.use('/password-reset/*', rateLimiter(5, 60 * 1000, 'rl:auth:reset'));
customerAuthRouter.use('/email-verification/*', rateLimiter(10, 60 * 1000, 'rl:auth:verification'));
customerAuthRouter.use('/oauth/*', rateLimiter(30, 60 * 1000, 'rl:auth:oauth'));

// ─── GET /capabilities ────────────────────────────────────────────────────────

customerAuthRouter.get('/capabilities', (c) => {
    const caps = getAuthCapabilities(c.env);
    return c.json({ data: caps });
});

// ─── POST /register ───────────────────────────────────────────────────────────

customerAuthRouter.post('/register', async (c) => {
    let rawBody: unknown;
    try {
        rawBody = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = CustomerRegisterSchema.safeParse(rawBody);
    if (!parsed.success) {
        return c.json({ error: 'Validation failed', fields: parsed.error.flatten().fieldErrors }, 422);
    }

    const db = createDB(c.env.DB);
    try {
        const result = await registerCustomerWithPassword(db, parsed.data);
        setCustomerCookies(c, result.sessionToken, result.csrfToken, c.env.ENVIRONMENT === 'production');

        // Dispatch email verification link if token was generated
        if (result.verificationRawToken) {
            const baseUrl = getCanonicalAppOrigin(c.env, c.req.header('origin'));
            const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(result.verificationRawToken)}`;
            sendCustomerVerificationEmail(c.env, parsed.data.email, verifyUrl).catch((emailErr) => {
                console.error('[customer-auth] Non-blocking verification email delivery failed:', emailErr instanceof Error ? emailErr.message : 'error');
            });
        }

        return c.json({ success: true, user: result.user }, 201);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[customer-auth] Registration error:', msg);
        if (msg.toLowerCase().includes('already exists')) {
            return c.json({ error: 'An account with this email address already exists.' }, 409);
        }
        return c.json({ error: 'We could not create your account. Please try again.' }, 400);
    }
});

// ─── POST /login ──────────────────────────────────────────────────────────────

customerAuthRouter.post('/login', async (c) => {
    let rawBody: unknown;
    try {
        rawBody = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = CustomerLoginSchema.safeParse(rawBody);
    if (!parsed.success) {
        return c.json({ error: 'Validation failed', fields: parsed.error.flatten().fieldErrors }, 422);
    }

    const db = createDB(c.env.DB);
    try {
        const result = await loginCustomerWithPassword(db, parsed.data);
        setCustomerCookies(c, result.sessionToken, result.csrfToken, c.env.ENVIRONMENT === 'production');
        return c.json({ success: true, user: result.user }, 200);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[customer-auth] Login error:', msg);
        if (msg.toLowerCase().includes('disabled')) {
            return c.json({ error: 'This account has been disabled. Please contact support.' }, 403);
        }
        return c.json({ error: 'Invalid email or password.' }, 401);
    }
});

// ─── POST /logout ─────────────────────────────────────────────────────────────

customerAuthRouter.post('/logout', async (c) => {
    const rawSession = getCookie(c, SESSION_COOKIE_NAME);
    if (rawSession) {
        try {
            const db = createDB(c.env.DB);
            await revokeCustomerSession(db, rawSession);
        } catch {
            // Ignore error during session revocation
        }
    }

    clearCustomerCookies(c, c.env.ENVIRONMENT === 'production');
    return c.json({ success: true, message: 'Logged out successfully' });
});

// ─── GET /me ──────────────────────────────────────────────────────────────────

customerAuthRouter.get('/me', customerAuthMiddleware, async (c) => {
    const customerUser = c.get('customerUser');
    if (!customerUser) {
        return c.json({ error: 'User not found' }, 404);
    }
    return c.json({ data: toSafeUserDto(customerUser) });
});

// ─── PUT /me ──────────────────────────────────────────────────────────────────

customerAuthRouter.put('/me', customerAuthMiddleware, async (c) => {
    const customer = c.get('customer')!;
    let rawBody: unknown;
    try {
        rawBody = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = CustomerUpdateProfileSchema.safeParse(rawBody);
    if (!parsed.success) {
        return c.json({ error: 'Validation failed', fields: parsed.error.flatten().fieldErrors }, 422);
    }

    const db = createDB(c.env.DB);
    const now = new Date().toISOString();

    await db
        .update(schema.users)
        .set({
            ...(parsed.data.displayName !== undefined && { displayName: parsed.data.displayName }),
            ...(parsed.data.avatarUrl !== undefined && { avatarUrl: parsed.data.avatarUrl }),
            updatedAt: now,
        })
        .where(eq(schema.users.id, customer.userId));

    const updated = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, customer.userId))
        .limit(1)
        .then((r) => r[0]);

    if (!updated) {
        return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ success: true, user: toSafeUserDto(updated) });
});

// ─── GET /oauth/:provider/start ───────────────────────────────────────────────

customerAuthRouter.get('/oauth/:provider/start', async (c) => {
    const provider = c.req.param('provider');
    if (provider !== 'google' && provider !== 'x') {
        return c.json({ error: 'Unsupported OAuth provider' }, 400);
    }

    const returnTo = c.req.query('returnTo');

    try {
        const { authUrl } = await startOAuthFlow(c.env, provider, returnTo);
        const format = c.req.query('format');
        if (format === 'json') {
            return c.json({ authUrl });
        }
        return c.redirect(authUrl, 302);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initiate OAuth flow';
        return c.json({ error: message }, 500);
    }
});

// ─── GET /oauth/:provider/callback ────────────────────────────────────────────

customerAuthRouter.get('/oauth/:provider/callback', async (c) => {
    const provider = c.req.param('provider');
    if (provider !== 'google' && provider !== 'x') {
        return c.json({ error: 'Unsupported OAuth provider' }, 400);
    }

    const code = c.req.query('code');
    const state = c.req.query('state');
    const errorParam = c.req.query('error');

    const appOrigin = getCanonicalAppOrigin(c.env, c.req.header('origin'));

    if (errorParam) {
        const desc = c.req.query('error_description') || errorParam;
        console.warn(`[oauth/${provider}] Provider returned error:`, desc);
        return c.redirect(`${appOrigin}/login?error=${encodeURIComponent('Sign in was cancelled or denied by provider.')}`, 302);
    }

    if (!code || !state) {
        return c.redirect(`${appOrigin}/login?error=${encodeURIComponent('Missing authorization code or state.')}`, 302);
    }

    const db = createDB(c.env.DB);
    try {
        const result = await handleOAuthCallback(c.env, db, provider, code, state);
        setCustomerCookies(c, result.sessionToken, result.csrfToken, c.env.ENVIRONMENT === 'production');
        const destination = sanitizeReturnTo(result.returnTo);
        const redirectUrl = `${appOrigin}${destination.startsWith('/') ? destination : `/${destination}`}`;
        return c.redirect(redirectUrl, 302);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'OAuth sign in failed';
        console.error(`[oauth/${provider}/callback] Error:`, message);
        return c.redirect(`${appOrigin}/login?error=${encodeURIComponent(message)}`, 302);
    }
});

// ─── POST /password-reset/request ─────────────────────────────────────────────

customerAuthRouter.post('/password-reset/request', async (c) => {
    let rawBody: unknown;
    try {
        rawBody = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = CustomerPasswordResetRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
        return c.json({ error: 'Validation failed', fields: parsed.error.flatten().fieldErrors }, 422);
    }

    const db = createDB(c.env.DB);
    const normalizedEmail = parsed.data.email.toLowerCase();

    const user = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, normalizedEmail))
        .limit(1)
        .then((r) => r[0]);

    if (user && !user.disabledAt) {
        const { rawToken, tokenHash } = await generateRandomToken();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour

        await db.insert(schema.customerTokens).values({
            userId: user.id,
            tokenHash,
            purpose: 'password_reset',
            expiresAt,
            createdAt: now.toISOString(),
        });

        // Email delivery via Resend (if provisioned)
        if (c.env.RESEND_API_KEY && c.env.RESEND_FROM_EMAIL) {
            try {
                const resetUrl = `https://dreamwebapp.com/reset-password?token=${rawToken}`;
                await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from: c.env.RESEND_FROM_EMAIL,
                        to: [user.email!],
                        subject: 'Reset your DreamWebApp password',
                        html: `<p>Hello,</p><p>You requested a password reset. Click the link below to set a new password:</p><p><a href="${resetUrl}">Reset Password</a></p><p>This link expires in 1 hour.</p>`,
                    }),
                });
            } catch (resendErr) {
                console.error('[auth/password-reset] Failed to dispatch email:', resendErr);
            }
        }
    }

    // Generic response to avoid account enumeration
    const message = c.env.RESEND_API_KEY
        ? 'If an account with that email exists, password reset instructions have been sent.'
        : 'If an account with that email exists, a password reset request was recorded. Note: email delivery is not configured in this environment.';

    return c.json({ success: true, message });
});

// ─── POST /password-reset/confirm ─────────────────────────────────────────────

customerAuthRouter.post('/password-reset/confirm', async (c) => {
    let rawBody: unknown;
    try {
        rawBody = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = CustomerPasswordResetConfirmSchema.safeParse(rawBody);
    if (!parsed.success) {
        return c.json({ error: 'Validation failed', fields: parsed.error.flatten().fieldErrors }, 422);
    }

    const { token, newPassword } = parsed.data;
    const tokenHash = await sha256Hex(token);
    const db = createDB(c.env.DB);

    const tokenRecord = await db
        .select()
        .from(schema.customerTokens)
        .where(
            and(
                eq(schema.customerTokens.tokenHash, tokenHash),
                eq(schema.customerTokens.purpose, 'password_reset'),
                sql`${schema.customerTokens.consumedAt} IS NULL`,
            ),
        )
        .limit(1)
        .then((r) => r[0]);

    if (!tokenRecord || new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
        return c.json({ error: 'Invalid or expired password reset token.' }, 400);
    }

    const newHash = await hashPassword(newPassword);
    const now = new Date().toISOString();

    // Update user password and bump tokenVersion
    await db
        .update(schema.users)
        .set({
            passwordHash: newHash,
            tokenVersion: sql`${schema.users.tokenVersion} + 1`,
            updatedAt: now,
        })
        .where(eq(schema.users.id, tokenRecord.userId));

    // Revoke all existing sessions
    await revokeAllCustomerSessions(db, tokenRecord.userId);

    // Consume the token
    await db
        .update(schema.customerTokens)
        .set({ consumedAt: now })
        .where(eq(schema.customerTokens.id, tokenRecord.id));

    return c.json({ success: true, message: 'Password reset successful. Please sign in with your new password.' });
});

// ─── POST /email-verification/confirm ─────────────────────────────────────────

customerAuthRouter.post('/email-verification/confirm', async (c) => {
    let rawBody: unknown;
    try {
        rawBody = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = CustomerEmailVerificationConfirmSchema.safeParse(rawBody);
    if (!parsed.success) {
        return c.json({ error: 'Validation failed', fields: parsed.error.flatten().fieldErrors }, 422);
    }

    const db = createDB(c.env.DB);
    try {
        const result = await confirmEmailVerification(db, parsed.data.token);
        return c.json({ success: true, message: result.message, email: result.email });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Verification failed';
        console.error('[customer-auth/verify-confirm] Error:', msg);
        return c.json({ error: msg }, 400);
    }
});

// ─── POST /email-verification/resend ──────────────────────────────────────────

customerAuthRouter.post('/email-verification/resend', customerAuthMiddleware, async (c) => {
    const customer = c.get('customer')!;
    if (!customer.email) {
        return c.json({ error: 'No email address associated with this account.' }, 400);
    }

    const db = createDB(c.env.DB);
    const user = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, customer.userId))
        .limit(1)
        .then((r) => r[0]);

    if (!user || user.disabledAt) {
        return c.json({ error: 'Account disabled or not found.' }, 403);
    }

    if (user.emailVerified) {
        return c.json({ success: true, message: 'Your email address is already verified.' });
    }

    try {
        const rawToken = await createEmailVerificationToken(db, user.id, user.email || customer.email);
        const baseUrl = getCanonicalAppOrigin(c.env, c.req.header('origin'));
        const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;

        const sendResult = await sendCustomerVerificationEmail(c.env, user.email || customer.email, verifyUrl);
        if (!sendResult.ok) {
            return c.json({
                error: sendResult.reason === 'not_configured'
                    ? 'Email service is not configured in this environment.'
                    : 'Failed to deliver verification email. Please try again later.',
                code: 'EMAIL_DELIVERY_FAILED',
            }, 503);
        }
        return c.json({ success: true, message: 'A verification link has been sent to your email.' });
    } catch (err) {
        console.error('[customer-auth/verify-resend] Error:', err instanceof Error ? err.message : 'error');
        return c.json({ error: 'Failed to send verification email. Please try again later.' }, 500);
    }
});
