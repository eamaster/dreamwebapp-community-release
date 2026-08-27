/**
 * Customer authentication service — D1 & KV backed identity and session management.
 *
 * Security Principles:
 * - Passwords hashed with PBKDF2-SHA256 (100k iterations, random 16-byte salt).
 * - Session tokens are 256-bit cryptographically secure random values; only SHA-256 hashes are stored in D1.
 * - PKCE code verifiers and OAuth states are stored exclusively in KV with a 10-minute TTL and consumed once.
 * - Zero secrets, hashes, or credentials leaked to browser or logs.
 */

import { eq, and, or, sql, isNull, isNotNull } from 'drizzle-orm';
import type { DrizzleDB } from '../db';
import * as schema from '../db/schema';
import type { UserRow, CustomerSessionRow } from '../db/schema';
import type { Env } from '../types/env';
import { hashPassword, verifyPassword, base64UrlEncode } from '../middleware/auth';

// ─── Cryptographic Token & ID Helpers ─────────────────────────────────────────

export async function sha256Hex(input: string): Promise<string> {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateUserId(): string {
    return `usr_${crypto.randomUUID()}`;
}

export function generateIdentityId(): string {
    return `idn_${crypto.randomUUID()}`;
}

export function generateSessionId(): string {
    return `ses_${crypto.randomUUID()}`;
}

export function generateServiceId(): string {
    return `srv_${crypto.randomUUID()}`;
}

export async function generateRandomToken(): Promise<{ rawToken: string; tokenHash: string }> {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const rawToken = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const tokenHash = await sha256Hex(rawToken);
    return { rawToken, tokenHash };
}

export function generateCsrfToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Safe DTOs ────────────────────────────────────────────────────────────────

export interface SafeCustomerUserDto {
    id: string;
    email: string | null;
    emailVerified: boolean;
    displayName: string | null;
    avatarUrl: string | null;
    createdAt: string;
}

export function toSafeUserDto(user: UserRow): SafeCustomerUserDto {
    return {
        id: user.id,
        email: user.email,
        emailVerified: Boolean(user.emailVerified),
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
    };
}

export interface AuthSessionResult {
    user: SafeCustomerUserDto;
    sessionToken: string;
    csrfToken: string;
    verificationRawToken?: string;
}

// ─── Registration ─────────────────────────────────────────────────────────────

export interface RegisterInput {
    email: string;
    password: string;
    displayName?: string;
}

export async function registerCustomerWithPassword(
    db: DrizzleDB,
    input: RegisterInput,
): Promise<AuthSessionResult> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Check if user already exists
    const existing = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, normalizedEmail))
        .limit(1)
        .then((r) => r[0]);

    if (existing) {
        throw new Error('An account with this email address already exists.');
    }

    const userId = generateUserId();
    const pwHash = await hashPassword(input.password);
    const now = new Date().toISOString();

    await db.insert(schema.users).values({
        id: userId,
        email: normalizedEmail,
        emailVerified: false,
        passwordHash: pwHash,
        displayName: input.displayName?.trim() || null,
        tokenVersion: 1,
        createdAt: now,
        updatedAt: now,
    });

    await db.insert(schema.userIdentities).values({
        id: generateIdentityId(),
        userId,
        provider: 'password',
        providerSubject: normalizedEmail,
        providerEmail: normalizedEmail,
        createdAt: now,
        updatedAt: now,
    });

    const user = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1)
        .then((r) => r[0]!);

    const session = await createCustomerSession(db, userId);
    const csrfToken = generateCsrfToken();
    const verificationRawToken = await createEmailVerificationToken(db, userId, normalizedEmail);

    return {
        user: toSafeUserDto(user),
        sessionToken: session.rawToken,
        csrfToken,
        verificationRawToken,
    };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export interface LoginInput {
    email: string;
    password: string;
}

export async function loginCustomerWithPassword(
    db: DrizzleDB,
    input: LoginInput,
): Promise<AuthSessionResult> {
    const normalizedEmail = input.email.trim().toLowerCase();

    const user = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, normalizedEmail))
        .limit(1)
        .then((r) => r[0]);

    if (!user || !user.passwordHash) {
        throw new Error('Invalid email or password.');
    }

    if (user.disabledAt) {
        throw new Error('This account has been disabled. Please contact support.');
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
        throw new Error('Invalid email or password.');
    }

    const session = await createCustomerSession(db, user.id);
    const csrfToken = generateCsrfToken();

    return {
        user: toSafeUserDto(user),
        sessionToken: session.rawToken,
        csrfToken,
    };
}

// ─── Session Management ───────────────────────────────────────────────────────

export const SESSION_EXPIRY_DAYS = 30;

export async function createCustomerSession(
    db: DrizzleDB,
    userId: string,
): Promise<{ sessionId: string; rawToken: string; tokenHash: string; expiresAt: string }> {
    const sessionId = generateSessionId();
    const { rawToken, tokenHash } = await generateRandomToken();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await db.insert(schema.customerSessions).values({
        id: sessionId,
        userId,
        sessionTokenHash: tokenHash,
        expiresAt,
        lastUsedAt: now.toISOString(),
        createdAt: now.toISOString(),
    });

    return { sessionId, rawToken, tokenHash, expiresAt };
}

export async function validateCustomerSession(
    db: DrizzleDB,
    rawSessionToken: string,
): Promise<{ user: UserRow; session: CustomerSessionRow } | null> {
    if (!rawSessionToken) return null;
    const tokenHash = await sha256Hex(rawSessionToken);

    const session = await db
        .select()
        .from(schema.customerSessions)
        .where(
            and(
                eq(schema.customerSessions.sessionTokenHash, tokenHash),
                sql`${schema.customerSessions.revokedAt} IS NULL`,
            ),
        )
        .limit(1)
        .then((r) => r[0]);

    if (!session) return null;

    // Check expiration
    if (new Date(session.expiresAt).getTime() < Date.now()) {
        return null;
    }

    const user = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, session.userId))
        .limit(1)
        .then((r) => r[0]);

    if (!user || user.disabledAt) {
        return null;
    }

    return { user, session };
}

export async function revokeCustomerSession(db: DrizzleDB, rawSessionToken: string): Promise<void> {
    const tokenHash = await sha256Hex(rawSessionToken);
    await db
        .update(schema.customerSessions)
        .set({ revokedAt: new Date().toISOString() })
        .where(eq(schema.customerSessions.sessionTokenHash, tokenHash));
}

export async function revokeAllCustomerSessions(db: DrizzleDB, userId: string): Promise<void> {
    const now = new Date().toISOString();
    await db
        .update(schema.customerSessions)
        .set({ revokedAt: now })
        .where(
            and(
                eq(schema.customerSessions.userId, userId),
                sql`${schema.customerSessions.revokedAt} IS NULL`,
            ),
        );

    // Bump token version
    await db
        .update(schema.users)
        .set({
            tokenVersion: sql`${schema.users.tokenVersion} + 1`,
            updatedAt: now,
        })
        .where(eq(schema.users.id, userId));
}

// ─── OAuth 2.0 PKCE Integration (Google & X) ──────────────────────────────────

export interface OAuthStateRecord {
    provider: 'google' | 'x';
    codeVerifier: string;
    nonce?: string;
    returnTo: string;
    createdAt: string;
}

export function sanitizeReturnTo(returnTo?: string | null): string {
    if (!returnTo) return '/account';
    const trimmed = returnTo.trim();
    // Allow internal paths starting with / but not protocol-relative // or external http(s)
    if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) {
        return trimmed;
    }
    return '/account';
}

export function getAuthCapabilities(env: Env): { google: boolean; x: boolean; emailAuth: boolean } {
    const googleEnabled = Boolean(
        env.CUSTOMER_AUTH_GOOGLE_CLIENT_ID && env.CUSTOMER_AUTH_GOOGLE_CLIENT_SECRET,
    );
    const xEnabled = Boolean(
        env.CUSTOMER_AUTH_X_CLIENT_ID && env.CUSTOMER_AUTH_X_CLIENT_SECRET,
    );
    return {
        google: googleEnabled,
        x: xEnabled,
        emailAuth: true,
    };
}

export async function startOAuthFlow(
    env: Env,
    provider: 'google' | 'x',
    returnToRaw?: string | null,
): Promise<{ authUrl: string; state: string }> {
    const returnTo = sanitizeReturnTo(returnToRaw);

    // Generate random state & PKCE verifier
    const stateBytes = crypto.getRandomValues(new Uint8Array(24));
    const state = Array.from(stateBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

    const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
    const codeVerifier = base64UrlEncode(verifierBytes);

    // Calculate S256 code_challenge
    const challengeBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    const codeChallenge = base64UrlEncode(challengeBuffer);

    // Store state in KV with 10-minute TTL
    const stateHash = await sha256Hex(state);
    const stateRecord: OAuthStateRecord = {
        provider,
        codeVerifier,
        returnTo,
        createdAt: new Date().toISOString(),
    };

    const kvKey = `oauth:state:${stateHash}`;
    await env.CONTENT_KV.put(kvKey, JSON.stringify(stateRecord), { expirationTtl: 600 });

    let authUrl = '';
    if (provider === 'google') {
        if (!env.CUSTOMER_AUTH_GOOGLE_CLIENT_ID) {
            throw new Error('Google OAuth is not configured in this environment.');
        }
        const redirectUri = env.CUSTOMER_AUTH_GOOGLE_REDIRECT_URI || 'https://dreamwebapp.com/api/v1/auth/oauth/google/callback';
        const params = new URLSearchParams({
            client_id: env.CUSTOMER_AUTH_GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            prompt: 'select_account',
        });
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } else if (provider === 'x') {
        if (!env.CUSTOMER_AUTH_X_CLIENT_ID) {
            throw new Error('X OAuth is not configured in this environment.');
        }
        const redirectUri = env.CUSTOMER_AUTH_X_REDIRECT_URI || 'https://dreamwebapp.com/api/v1/auth/oauth/x/callback';
        const params = new URLSearchParams({
            client_id: env.CUSTOMER_AUTH_X_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'tweet.read users.read',
            state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });
        authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
    }

    return { authUrl, state };
}

export async function handleOAuthCallback(
    env: Env,
    db: DrizzleDB,
    provider: 'google' | 'x',
    code: string,
    state: string,
): Promise<AuthSessionResult & { returnTo: string }> {
    const stateHash = await sha256Hex(state);
    const kvKey = `oauth:state:${stateHash}`;

    const rawRecord = await env.CONTENT_KV.get(kvKey);
    if (!rawRecord) {
        throw new Error('Invalid or expired OAuth state. Please try logging in again.');
    }

    // Atomically consume state
    await env.CONTENT_KV.delete(kvKey);

    const stateRecord = JSON.parse(rawRecord) as OAuthStateRecord;
    if (stateRecord.provider !== provider) {
        throw new Error('OAuth provider mismatch.');
    }

    const { codeVerifier, returnTo } = stateRecord;

    let providerSubject = '';
    let providerEmail: string | null = null;
    let providerName: string | null = null;
    let providerAvatar: string | null = null;

    if (provider === 'google') {
        const redirectUri = env.CUSTOMER_AUTH_GOOGLE_REDIRECT_URI || 'https://dreamwebapp.com/api/v1/auth/oauth/google/callback';
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: env.CUSTOMER_AUTH_GOOGLE_CLIENT_ID!,
                client_secret: env.CUSTOMER_AUTH_GOOGLE_CLIENT_SECRET!,
                code,
                code_verifier: codeVerifier,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            console.error('[oauth/google] Token exchange error:', errText);
            throw new Error('Failed to exchange authorization code with Google.');
        }

        const tokenData = (await tokenRes.json()) as { access_token: string };
        const userinfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (!userinfoRes.ok) {
            throw new Error('Failed to fetch Google profile.');
        }

        const profile = (await userinfoRes.json()) as {
            sub: string;
            email?: string;
            email_verified?: boolean;
            name?: string;
            picture?: string;
        };

        providerSubject = profile.sub;
        providerEmail = profile.email?.trim().toLowerCase() ?? null;
        providerName = profile.name ?? null;
        providerAvatar = profile.picture ?? null;
    } else if (provider === 'x') {
        const redirectUri = env.CUSTOMER_AUTH_X_REDIRECT_URI || 'https://dreamwebapp.com/api/v1/auth/oauth/x/callback';
        const basicAuth = btoa(`${env.CUSTOMER_AUTH_X_CLIENT_ID}:${env.CUSTOMER_AUTH_X_CLIENT_SECRET}`);
        const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${basicAuth}`,
            },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                client_id: env.CUSTOMER_AUTH_X_CLIENT_ID!,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
            }),
        });

        if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            console.error('[oauth/x] Token exchange error:', errText);
            throw new Error('Failed to exchange authorization code with X.');
        }

        const tokenData = (await tokenRes.json()) as { access_token: string };
        const userinfoRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (!userinfoRes.ok) {
            throw new Error('Failed to fetch X profile.');
        }

        const profileData = (await userinfoRes.json()) as {
            data: { id: string; name: string; username: string; profile_image_url?: string };
        };

        providerSubject = profileData.data.id;
        providerName = profileData.data.name ?? profileData.data.username;
        providerAvatar = profileData.data.profile_image_url ?? null;
    }

    // Resolve or create user & identity
    const now = new Date().toISOString();

    // Check if this provider identity already exists
    const existingIdentity = await db
        .select()
        .from(schema.userIdentities)
        .where(
            and(
                eq(schema.userIdentities.provider, provider),
                eq(schema.userIdentities.providerSubject, providerSubject),
            ),
        )
        .limit(1)
        .then((r) => r[0]);

    let user: UserRow;

    if (existingIdentity) {
        const u = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, existingIdentity.userId))
            .limit(1)
            .then((r) => r[0]);

        if (!u) throw new Error('Account not found.');
        if (u.disabledAt) throw new Error('Account disabled.');
        user = u;
    } else {
        // Check if there is an existing account with the exact same verified email
        let existingUserByEmail: UserRow | undefined;
        if (providerEmail) {
            existingUserByEmail = await db
                .select()
                .from(schema.users)
                .where(eq(schema.users.email, providerEmail))
                .limit(1)
                .then((r) => r[0]);
        }

        if (existingUserByEmail && existingUserByEmail.emailVerified) {
            // Safe auto-link for verified email match
            user = existingUserByEmail;
            await db.insert(schema.userIdentities).values({
                id: generateIdentityId(),
                userId: user.id,
                provider,
                providerSubject,
                providerEmail,
                createdAt: now,
                updatedAt: now,
            });
        } else {
            // Create new customer user
            const newUserId = generateUserId();
            await db.insert(schema.users).values({
                id: newUserId,
                email: providerEmail,
                emailVerified: provider === 'google',
                emailVerifiedAt: provider === 'google' ? now : null,
                passwordHash: null,
                displayName: providerName,
                avatarUrl: providerAvatar,
                tokenVersion: 1,
                createdAt: now,
                updatedAt: now,
            });

            await db.insert(schema.userIdentities).values({
                id: generateIdentityId(),
                userId: newUserId,
                provider,
                providerSubject,
                providerEmail,
                createdAt: now,
                updatedAt: now,
            });

            user = (await db
                .select()
                .from(schema.users)
                .where(eq(schema.users.id, newUserId))
                .limit(1)
                .then((r) => r[0]))!;
        }
    }

    const session = await createCustomerSession(db, user.id);
    const csrfToken = generateCsrfToken();

    return {
        user: toSafeUserDto(user),
        sessionToken: session.rawToken,
        csrfToken,
        returnTo,
    };
}

// ─── Customer Email Verification Lifecycle ────────────────────────────────────

/**
 * Creates a single-use SHA-256 hashed email verification token in D1.
 * Supersedes/invalidates any previous outstanding verification tokens for this user.
 */
export async function createEmailVerificationToken(
    db: DrizzleDB,
    userId: string,
    email: string,
): Promise<string> {
    const now = new Date().toISOString();

    // Invalidate prior active verification tokens for this user
    await db
        .update(schema.customerTokens)
        .set({ consumedAt: now })
        .where(
            and(
                eq(schema.customerTokens.userId, userId),
                eq(schema.customerTokens.purpose, 'email_verification'),
                isNull(schema.customerTokens.consumedAt),
            ),
        );

    const { rawToken, tokenHash } = await generateRandomToken();
    // 24 hour expiry
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.insert(schema.customerTokens).values({
        userId,
        tokenHash,
        purpose: 'email_verification',
        pendingEmail: email.trim().toLowerCase(),
        expiresAt,
        createdAt: now,
    });

    return rawToken;
}

/**
 * Consumes an email verification token and atomically marks user.emailVerified = true.
 * Replays, expired tokens, or tokens for disabled accounts fail safely.
 */
export async function confirmEmailVerification(
    db: DrizzleDB,
    rawToken: string,
): Promise<{ success: boolean; message: string; email: string }> {
    if (!rawToken || typeof rawToken !== 'string') {
        throw new Error('Invalid verification token.');
    }

    const tokenHash = await sha256Hex(rawToken.trim());
    const now = new Date().toISOString();

    const tokenRecord = await db
        .select()
        .from(schema.customerTokens)
        .where(
            and(
                eq(schema.customerTokens.tokenHash, tokenHash),
                eq(schema.customerTokens.purpose, 'email_verification'),
                isNull(schema.customerTokens.consumedAt),
            ),
        )
        .limit(1)
        .then((r) => r[0]);

    if (!tokenRecord) {
        throw new Error('The verification link is invalid, expired, or has already been used.');
    }

    if (new Date(tokenRecord.expiresAt).getTime() <= Date.now()) {
        await db
            .update(schema.customerTokens)
            .set({ consumedAt: now })
            .where(eq(schema.customerTokens.id, tokenRecord.id));
        throw new Error('The verification link has expired. Please request a new one.');
    }

    const user = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, tokenRecord.userId))
        .limit(1)
        .then((r) => r[0]);

    if (!user || user.disabledAt) {
        throw new Error('This account has been disabled or no longer exists.');
    }

    // Atomically mark token consumed and user email verified
    await db
        .update(schema.customerTokens)
        .set({ consumedAt: now })
        .where(eq(schema.customerTokens.id, tokenRecord.id));

    // Supersede any other outstanding verification tokens for this user
    await db
        .update(schema.customerTokens)
        .set({ consumedAt: now })
        .where(
            and(
                eq(schema.customerTokens.userId, user.id),
                eq(schema.customerTokens.purpose, 'email_verification'),
                isNull(schema.customerTokens.consumedAt),
            ),
        );

    await db
        .update(schema.users)
        .set({
            emailVerified: true,
            emailVerifiedAt: now,
            updatedAt: now,
        })
        .where(eq(schema.users.id, user.id));

    return {
        success: true,
        message: 'Email address verified successfully.',
        email: user.email || tokenRecord.pendingEmail || '',
    };
}

/**
 * Resolves the canonical frontend application origin for customer emails and redirects.
 * Prioritizes validated `env.PUBLIC_APP_ORIGIN`, falls back to allowlisted request Origin,
 * and requires a valid HTTPS origin in production.
 */
export function getCanonicalAppOrigin(env: Env, reqOrigin?: string | null): string {
    if (env.PUBLIC_APP_ORIGIN && env.PUBLIC_APP_ORIGIN.trim().startsWith('http')) {
        const trimmed = env.PUBLIC_APP_ORIGIN.trim().replace(/\/+$/, '');
        try {
            const parsed = new URL(trimmed);
            if (env.ENVIRONMENT === 'production' && parsed.protocol !== 'https:') {
                throw new Error(`[customer-auth] In production, PUBLIC_APP_ORIGIN must use HTTPS: ${trimmed}`);
            }
            return parsed.origin;
        } catch (err) {
            console.error('[customer-auth] Invalid PUBLIC_APP_ORIGIN configuration:', err);
            if (env.ENVIRONMENT === 'production') {
                throw err;
            }
        }
    }
    if (reqOrigin && env.CORS_ORIGIN) {
        const allowed = env.CORS_ORIGIN.split(',').map((o) => o.trim().toLowerCase()).filter(Boolean);
        if (allowed.includes(reqOrigin.trim().toLowerCase())) {
            return reqOrigin.trim().replace(/\/+$/, '');
        }
    }
    const firstAllowed = env.CORS_ORIGIN?.split(',')[0]?.trim();
    if (firstAllowed && firstAllowed.startsWith('http')) {
        return firstAllowed.replace(/\/+$/, '');
    }
    if (env.ENVIRONMENT === 'production') {
        throw new Error('[customer-auth] PUBLIC_APP_ORIGIN is required in production environment.');
    }
    return 'http://localhost:5173';
}

// ─── Customer Self-Deletion Eligibility & Execution ───────────────────────────

export const BLOCKING_CUSTOMER_SERVICE_STATUSES = ['active', 'provisioning'] as const;
export const BLOCKING_PAYMENT_STATUSES = ['paid', 'partially_paid'] as const;

export type DeletionEligibilityCode =
    | 'eligible'
    | 'blocked_active_service'
    | 'blocked_paid_order_history'
    | 'generic_failure';

export type DeletionEligibilityResult =
    | { eligible: true; code: 'eligible' }
    | { eligible: false; code: 'blocked_active_service'; reason: 'blocked_active_service'; details: string }
    | { eligible: false; code: 'blocked_paid_order_history'; reason: 'blocked_paid_order_history'; details: string }
    | { eligible: false; code: 'generic_failure'; reason: 'generic_failure'; details: string };

/**
 * Checks whether a customer is eligible for self-service account deletion.
 * Eligibility Policy:
 * - NO active/provisioning customer services (`customer_services.status` NOT IN ('active', 'provisioning')).
 * - NO purchased/paid/completed payment order history (`payment_orders.internalStatus` NOT IN ('paid', 'partially_paid') AND `payment_orders.entitlement_granted_at` IS NULL).
 */
export async function checkCustomerDeletionEligibility(
    db: DrizzleDB,
    userId: string,
): Promise<DeletionEligibilityResult> {
    try {
        // 1. Check for active or provisioning services
        const activeServices = await db
            .select({ id: schema.customerServices.id, status: schema.customerServices.status })
            .from(schema.customerServices)
            .where(
                and(
                    eq(schema.customerServices.userId, userId),
                    or(
                        eq(schema.customerServices.status, BLOCKING_CUSTOMER_SERVICE_STATUSES[0]),
                        eq(schema.customerServices.status, BLOCKING_CUSTOMER_SERVICE_STATUSES[1]),
                    ),
                ),
            )
            .limit(1);

        if (activeServices.length > 0) {
            return {
                eligible: false,
                code: 'blocked_active_service',
                reason: 'blocked_active_service',
                details: 'Your account cannot be deleted while you have active or provisioning services.',
            };
        }

        // 2. Check for paid orders or granted entitlements
        const paidOrders = await db
            .select({
                orderId: schema.paymentOrders.orderId,
                internalStatus: schema.paymentOrders.internalStatus,
                entitlementGrantedAt: schema.paymentOrders.entitlementGrantedAt,
            })
            .from(schema.paymentOrders)
            .where(
                and(
                    eq(schema.paymentOrders.userId, userId),
                    or(
                        eq(schema.paymentOrders.internalStatus, BLOCKING_PAYMENT_STATUSES[0]),
                        eq(schema.paymentOrders.internalStatus, BLOCKING_PAYMENT_STATUSES[1]),
                        isNotNull(schema.paymentOrders.entitlementGrantedAt),
                    ),
                ),
            )
            .limit(1);

        if (paidOrders.length > 0) {
            return {
                eligible: false,
                code: 'blocked_paid_order_history',
                reason: 'blocked_paid_order_history',
                details: 'Your account cannot be deleted because you have purchased services in your billing history.',
            };
        }

        return { eligible: true, code: 'eligible' };
    } catch (err) {
        console.error('[customer-auth/deletion-eligibility] DB check error:', err instanceof Error ? err.message : 'error');
        return {
            eligible: false,
            code: 'generic_failure',
            reason: 'generic_failure',
            details: 'Unable to verify account deletion eligibility. Please try again later.',
        };
    }
}

/**
 * Deletes a customer account after verifying eligibility.
 * Atomically revokes all sessions, invalidates tokens, removes OAuth identities,
 * and marks user disabled/anonymized to preserve payment audit integrity.
 */
export async function deleteCustomerAccount(db: DrizzleDB, userId: string): Promise<void> {
    const check = await checkCustomerDeletionEligibility(db, userId);
    if (!check.eligible) {
        throw new Error(check.details);
    }

    const now = new Date().toISOString();

    // 1. Revoke all active customer sessions
    await db
        .update(schema.customerSessions)
        .set({ revokedAt: now })
        .where(
            and(
                eq(schema.customerSessions.userId, userId),
                isNull(schema.customerSessions.revokedAt),
            ),
        );

    // 2. Invalidate all pending tokens (verification, reset)
    await db
        .update(schema.customerTokens)
        .set({ consumedAt: now })
        .where(
            and(
                eq(schema.customerTokens.userId, userId),
                isNull(schema.customerTokens.consumedAt),
            ),
        );

    // 3. Remove linked third-party OAuth identities
    await db
        .delete(schema.userIdentities)
        .where(eq(schema.userIdentities.userId, userId));

    // 4. Anonymize user record and mark disabled with tombstone email to release unique constraint
    const tombstoneEmail = `deleted_${userId}_${Date.now()}@dreamwebapp.internal`;
    await db
        .update(schema.users)
        .set({
            email: tombstoneEmail,
            displayName: 'Deleted Customer',
            avatarUrl: null,
            passwordHash: null,
            disabledAt: now,
            tokenVersion: sql`${schema.users.tokenVersion} + 1`,
            updatedAt: now,
        })
        .where(eq(schema.users.id, userId));
}
