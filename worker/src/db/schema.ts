/**
 * Drizzle ORM schema for DreamWebApp D1 database.
 *
 * Tables:
 *  1. site_settings          — brand, navigation, footer, contact info
 *  2. services               — service offerings
 *  3. solutions              — industry solutions
 *  4. pricing_plans          — plan tiers
 *  5. pricing_addons         — add-on services
 *  6. faqs                   — FAQ entries
 *  7. contact_messages       — lead capture submissions
 *  8. admin_users            — CMS authentication
 *  9. password_reset_tokens  — admin password-reset flow state
 * 10. legal_pages            — CMS-editable Privacy Policy / Terms
 * 11. media_assets           — metadata for uploaded logo images (R2)
 * 12. payment_orders         — one row per crypto checkout attempt
 * 13. payment_events         — append-only IPN/webhook audit log
 */

import { sql } from 'drizzle-orm';
import {
    sqliteTable,
    text,
    integer,
    real,
} from 'drizzle-orm/sqlite-core';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Site Settings
// ─────────────────────────────────────────────────────────────────────────────

export const siteSettings = sqliteTable('site_settings', {
    id: integer('id').primaryKey({ autoIncrement: true }),

    // Brand
    brandName: text('brand_name').notNull(),
    brandTagline: text('brand_tagline').notNull(),
    brandDescription: text('brand_description').notNull(),

    // Contact
    contactEmail: text('contact_email').notNull(),
    /** Canonically E.164 (e.g. "+15551234567") once saved through the admin CMS. */
    contactPhone: text('contact_phone'),

    // Navigation — stored as JSON: Array<{ label: string; path: string }>
    navigationJson: text('navigation_json').notNull(),

    // Footer — stored as JSON: { sections: FooterSection[]; socialLinks: SocialLink[]; copyright: string }
    footerJson: text('footer_json').notNull(),

    // Header/footer logo — reference media_assets.id; null = fall back to the
    // built-in static brand logo.
    headerLogoAssetId: text('header_logo_asset_id'),
    footerLogoAssetId: text('footer_logo_asset_id'),

    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type SiteSettingsRow = typeof siteSettings.$inferSelect;
export type SiteSettingsInsert = typeof siteSettings.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Services
// ─────────────────────────────────────────────────────────────────────────────

export const services = sqliteTable('services', {
    id: text('id').primaryKey(), // slug, e.g. "chatbot-setup"
    name: text('name').notNull(),
    shortDescription: text('short_description').notNull(),
    longDescription: text('long_description').notNull(),
    icon: text('icon').notNull(),
    timeline: text('timeline').notNull(),

    // JSON arrays: string[]
    whoItsForJson: text('who_its_for_json').notNull(), // string[]
    includedJson: text('included_json').notNull(),     // string[]

    // Pricing stored as JSON: { type, amount?, note? }
    pricingJson: text('pricing_json').notNull(),

    sortOrder: integer('sort_order').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type ServiceRow = typeof services.$inferSelect;
export type ServiceInsert = typeof services.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 3. Solutions
// ─────────────────────────────────────────────────────────────────────────────

export const solutions = sqliteTable('solutions', {
    id: text('id').primaryKey(), // slug, e.g. "clinics"
    title: text('title').notNull(),
    icon: text('icon').notNull(),
    description: text('description').notNull(),
    ctaText: text('cta_text').notNull(),

    // JSON arrays: string[]
    painsJson: text('pains_json').notNull(),
    benefitsJson: text('benefits_json').notNull(),

    sortOrder: integer('sort_order').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type SolutionRow = typeof solutions.$inferSelect;
export type SolutionInsert = typeof solutions.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 4. Pricing Plans
// ─────────────────────────────────────────────────────────────────────────────

export const pricingPlans = sqliteTable('pricing_plans', {
    id: text('id').primaryKey(), // slug, e.g. "starter-bot"
    name: text('name').notNull(),
    description: text('description').notNull(),
    monthlyPrice: real('monthly_price').notNull().default(0),
    setupFee: real('setup_fee'),
    bestFor: text('best_for').notNull(),
    ctaText: text('cta_text').notNull(),
    badge: text('badge'),
    isHighlighted: integer('is_highlighted', { mode: 'boolean' }).notNull().default(false),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

    // JSON array of feature strings
    featuresJson: text('features_json').notNull(),

    sortOrder: integer('sort_order').notNull().default(0),

    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type PricingPlanRow = typeof pricingPlans.$inferSelect;
export type PricingPlanInsert = typeof pricingPlans.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 5. Pricing Add-ons
// ─────────────────────────────────────────────────────────────────────────────

export const pricingAddons = sqliteTable('pricing_addons', {
    id: text('id').primaryKey(), // slug, e.g. "inbox-automation"
    name: text('name').notNull(),
    description: text('description').notNull(),
    price: real('price').notNull(),
    priceType: text('price_type', { enum: ['one-time', 'monthly'] }).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),

    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type PricingAddonRow = typeof pricingAddons.$inferSelect;
export type PricingAddonInsert = typeof pricingAddons.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 6. FAQs
// ─────────────────────────────────────────────────────────────────────────────

export const faqs = sqliteTable('faqs', {
    id: text('id').primaryKey(), // slug, e.g. "setup-time"
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    category: text('category'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type FAQRow = typeof faqs.$inferSelect;
export type FAQInsert = typeof faqs.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 7. Contact Messages (Lead Capture)
// ─────────────────────────────────────────────────────────────────────────────

export const contactMessages = sqliteTable('contact_messages', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    businessType: text('business_type').notNull(),
    website: text('website'),
    // Optional visitor-supplied phone number, canonically stored E.164.
    // NULL when the visitor did not supply one — the field is never required.
    phone: text('phone'),
    message: text('message').notNull(),

    // IP address for rate-limit audit trail
    ipAddress: text('ip_address'),

    status: text('status', { enum: ['unread', 'read', 'archived'] })
        .notNull()
        .default('unread'),

    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type ContactMessageRow = typeof contactMessages.$inferSelect;
export type ContactMessageInsert = typeof contactMessages.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 8. Admin Users (CMS Authentication)
// ─────────────────────────────────────────────────────────────────────────────

export const adminUsers = sqliteTable('admin_users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(), // bcrypt/scrypt hash
    role: text('role', { enum: ['super_admin', 'editor'] })
        .notNull()
        .default('editor'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    /**
     * Bumped whenever a sensitive account change (password reset, verified
     * email change) must invalidate already-issued JWTs. Compared against
     * the `tv` claim in jwtMiddleware — see worker/src/middleware/auth.ts.
     */
    tokenVersion: integer('token_version').notNull().default(0),

    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    lastLoginAt: text('last_login_at'),
});

export type AdminUserRow = typeof adminUsers.$inferSelect;
export type AdminUserInsert = typeof adminUsers.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 9. Password Reset Tokens
// ─────────────────────────────────────────────────────────────────────────────

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    adminUserId: integer('admin_user_id').notNull(),
    /** SHA-256 hex digest of the raw token. The raw token is never stored. */
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: text('expires_at').notNull(),
    consumedAt: text('consumed_at'),
    /**
     * What this one-use token authorizes. 'password_reset' preserves the
     * original semantics; 'email_change' carries a pending new admin login
     * email (see `newEmail`) that is only committed once this token is
     * verified.
     */
    purpose: text('purpose', { enum: ['password_reset', 'email_change'] })
        .notNull()
        .default('password_reset'),
    /** Only set (and only meaningful) when `purpose` is 'email_change'. */
    newEmail: text('new_email'),

    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;
export type PasswordResetTokenInsert = typeof passwordResetTokens.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 10. Legal Pages
// ─────────────────────────────────────────────────────────────────────────────

export const legalPages = sqliteTable('legal_pages', {
    id: text('id').primaryKey(), // 'privacy-policy' | 'terms-of-service'
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),

    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type LegalPageRow = typeof legalPages.$inferSelect;
export type LegalPageInsert = typeof legalPages.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 11. Media Assets (uploaded logo metadata; binary lives in R2)
// ─────────────────────────────────────────────────────────────────────────────

export const mediaAssets = sqliteTable('media_assets', {
    id: text('id').primaryKey(), // opaque, server-generated (crypto.randomUUID())
    r2Key: text('r2_key').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),

    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type MediaAssetRow = typeof mediaAssets.$inferSelect;
export type MediaAssetInsert = typeof mediaAssets.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 12. Payment Orders (crypto checkout)
// ─────────────────────────────────────────────────────────────────────────────

export const paymentOrders = sqliteTable('payment_orders', {
    /**
     * Server-generated UUIDv4. Also used as the NOWPayments `order_id` field
     * so webhook correlation never depends on browser-supplied data.
     */
    orderId: text('order_id').primaryKey(),

    /**
     * SHA-256 hex of a random token returned to the browser at checkout so an
     * unauthenticated customer can poll their own order status without exposing
     * another user's order. Mutually exclusive with `userId` — one must be set.
     */
    statusTokenHash: text('status_token_hash'),

    /**
     * Optional: authenticated user ID if the checkout originates from a logged-in
     * session. When present, `statusTokenHash` may be omitted.
     */
    userId: text('user_id'),

    /** Internal plan/product key (e.g. "starter-bot"). Never a browser-supplied price. */
    planKey: text('plan_key').notNull(),

    /** Whether this payment covers a one-time charge, setup fee, or monthly period. */
    billingMode: text('billing_mode', { enum: ['one_time', 'setup', 'monthly'] }).notNull(),

    /**
     * The authoritative price amount as a decimal string (e.g. "299.00").
     * Stored as text to avoid floating-point rounding errors.
     */
    expectedPriceAmountDecimal: text('expected_price_amount_decimal').notNull(),

    /** ISO-4217 fiat currency code (e.g. "usd"). */
    priceCurrency: text('price_currency').notNull(),

    /** The crypto currency the customer chose to pay with (e.g. "btc", "usdttrc20"). */
    payCurrency: text('pay_currency').notNull(),

    /**
     * Estimated crypto pay amount (decimal string) populated when the invoice is
     * created. Null until the NOWPayments Create Invoice call succeeds.
     */
    expectedPayAmountDecimal: text('expected_pay_amount_decimal'),

    /**
     * NOWPayments invoice ID — set when the hosted invoice is created.
     * Null until the backend successfully calls the Create Invoice endpoint.
     */
    providerInvoiceId: text('provider_invoice_id'),

    /**
     * NOWPayments payment ID — set when NOWPayments assigns a payment to the invoice.
     * Unique per payment; null until first IPN delivery. Declared UNIQUE in SQL so
     * a duplicate provider_payment_id cannot point at two different orders.
     */
    providerPaymentId: text('provider_payment_id').unique(),

    /**
     * Normalized internal status derived from the provider status via
     * `mapProviderStatus`. This is the authoritative status for business logic.
     */
    internalStatus: text('internal_status', {
        enum: ['pending', 'waiting', 'confirming', 'partially_paid', 'paid', 'failed', 'expired', 'refunded'],
    }).notNull().default('pending'),

    /** Raw last provider status string, stored verbatim for debugging. */
    providerStatus: text('provider_status'),

    /**
     * Timestamp (ISO-8601) set once and only once when `internalStatus` transitions
     * to `paid`. Used as the entitlement signal for downstream feature delivery.
     */
    entitlementGrantedAt: text('entitlement_granted_at'),

    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type PaymentOrderRow = typeof paymentOrders.$inferSelect;
export type PaymentOrderInsert = typeof paymentOrders.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 13. Payment Events (IPN / webhook audit log)
// ─────────────────────────────────────────────────────────────────────────────

export const paymentEvents = sqliteTable('payment_events', {
    id: integer('id').primaryKey({ autoIncrement: true }),

    /** Foreign key to `payment_orders.order_id`. */
    orderId: text('order_id').notNull(),

    /** NOWPayments payment_id from the IPN body. */
    providerPaymentId: text('provider_payment_id').notNull(),

    /** Raw provider status string from this specific IPN delivery. */
    providerStatus: text('provider_status').notNull(),

    /**
     * Deterministic deduplication key: SHA-256 hex of
     * `${orderId}:${providerPaymentId}:${providerStatus}`.
     * UNIQUE constraint prevents duplicate processing of the same event.
     */
    eventFingerprint: text('event_fingerprint').notNull().unique(),

    /**
     * SHA-256 hex of the full raw IPN JSON body.
     * Stored for audit/debugging without persisting sensitive payload data.
     */
    payloadHash: text('payload_hash').notNull(),

    receivedAt: text('received_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type PaymentEventRow = typeof paymentEvents.$inferSelect;
export type PaymentEventInsert = typeof paymentEvents.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 14. Customer Users (Identity)
// ─────────────────────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
    id: text('id').primaryKey(), // opaque, e.g. "usr_550e8400..."
    email: text('email').unique(), // null for OAuth providers without email (e.g. X)
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    emailVerifiedAt: text('email_verified_at'),
    passwordHash: text('password_hash'), // PBKDF2 hash (null for OAuth-only users)
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    tokenVersion: integer('token_version').notNull().default(0), // Incremented on password reset
    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    disabledAt: text('disabled_at'),
});

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 15. User Identities (Linked Providers)
// ─────────────────────────────────────────────────────────────────────────────

export const userIdentities = sqliteTable('user_identities', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    provider: text('provider', { enum: ['password', 'google', 'x'] }).notNull(),
    providerSubject: text('provider_subject').notNull(),
    providerEmail: text('provider_email'),
    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type UserIdentityRow = typeof userIdentities.$inferSelect;
export type UserIdentityInsert = typeof userIdentities.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 16. Customer Sessions (Revocable HttpOnly Browser Sessions)
// ─────────────────────────────────────────────────────────────────────────────

export const customerSessions = sqliteTable('customer_sessions', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    sessionTokenHash: text('session_token_hash').notNull().unique(),
    expiresAt: text('expires_at').notNull(),
    lastUsedAt: text('last_used_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type CustomerSessionRow = typeof customerSessions.$inferSelect;
export type CustomerSessionInsert = typeof customerSessions.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 17. Customer Verification & Password Reset Tokens
// ─────────────────────────────────────────────────────────────────────────────

export const customerTokens = sqliteTable('customer_tokens', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    purpose: text('purpose', { enum: ['email_verification', 'password_reset'] }).notNull(),
    pendingEmail: text('pending_email'),
    expiresAt: text('expires_at').notNull(),
    consumedAt: text('consumed_at'),
    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type CustomerTokenRow = typeof customerTokens.$inferSelect;
export type CustomerTokenInsert = typeof customerTokens.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 18. Customer Services (Entitlement Lifecycle Projection)
// ─────────────────────────────────────────────────────────────────────────────

export const customerServices = sqliteTable('customer_services', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    orderId: text('order_id').notNull().unique(),
    planKey: text('plan_key').notNull(),
    serviceName: text('service_name').notNull(),
    status: text('status', {
        enum: ['active', 'provisioning', 'completed', 'suspended', 'cancelled'],
    }).notNull().default('active'),
    startedAt: text('started_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    expiresAt: text('expires_at'),
    nextReviewAt: text('next_review_at'),
    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
});

export type CustomerServiceRow = typeof customerServices.$inferSelect;
export type CustomerServiceInsert = typeof customerServices.$inferInsert;

