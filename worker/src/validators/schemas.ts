/**
 * Shared Zod validation schemas.
 * Used for both runtime validation in the Worker and as the canonical
 * type source for the frontend API client.
 */

import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { SOCIAL_PLATFORMS } from '../lib/social-links';

// ─────────────────────────────────────────────────────────────────────────────
// Contact / Lead Capture
// ─────────────────────────────────────────────────────────────────────────────

export const ContactSubmissionSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be under 100 characters'),

    email: z
        .string()
        .trim()
        .email('Please enter a valid email address')
        .max(254, 'Email must be under 254 characters'),

    businessType: z.enum(
        ['clinic', 'local-service', 'course-creator', 'online-shop', 'other'],
        { errorMap: () => ({ message: 'Please select a valid business type' }) }
    ),

    website: z
        .string()
        .trim()
        .max(500)
        .optional()
        .transform((v) => v || undefined),

    // Optional visitor phone number. When supplied it must be a valid,
    // internationally formatted (E.164) number — the same authority used for
    // the site's own contact phone in SiteSettingsWriteSchema below. Omitted
    // entirely (not required) so visitors who prefer email are never blocked.
    phone: z
        .string()
        .trim()
        .max(32)
        .optional()
        .transform((v) => v || undefined)
        .refine((v) => v === undefined || isValidPhoneNumber(v), {
            message: 'Please enter a valid phone number, including country code',
        }),

    message: z
        .string()
        .trim()
        .min(10, 'Message must be at least 10 characters')
        .max(2000, 'Message must be under 2000 characters'),

    // Optional metadata for leads originating from the AI chat widget.
    // Kept optional/backward-compatible so the existing ContactForm is unaffected.
    // The chat widget prefills its (editable) conversation summary directly into
    // `message`, so no separate transcript field is needed here.
    source: z.enum(['contact_page', 'chatbot']).optional().default('contact_page'),
});

export type ContactSubmission = z.infer<typeof ContactSubmissionSchema>;

// ──────────────────────────────────────────────────────────
// AI Chat — narrow chatbot MVP
// ──────────────────────────────────────────────────────────

// Only 'user' and 'assistant' are accepted from clients — a client can never
// supply a 'system' role message, so untrusted input can never masquerade as
// trusted system instructions.
export const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z
        .string()
        .trim()
        .min(1, 'Message cannot be empty')
        .max(1000, 'Message must be under 1000 characters'),
});

export const ChatRequestSchema = z
    .object({
        messages: z
            .array(ChatMessageSchema)
            .min(1, 'At least one message is required')
            .max(20, 'Conversation is too long for this session'),
    })
    .refine(
        (val) => val.messages.reduce((sum, m) => sum + m.content.length, 0) <= 6000,
        { message: 'Conversation is too long', path: ['messages'] }
    )
    .refine(
        (val) => val.messages[val.messages.length - 1]?.role === 'user',
        { message: 'The last message must be from the user', path: ['messages'] }
    );

export type ChatMessageInput = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Update contact message status
// ─────────────────────────────────────────────────────────────────────────────

export const UpdateContactStatusSchema = z.object({
    status: z.enum(['unread', 'read', 'archived']),
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Auth Login
// ─────────────────────────────────────────────────────────────────────────────

export const AdminLoginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(8),
});

export type AdminLogin = z.infer<typeof AdminLoginSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Service CRUD
// ─────────────────────────────────────────────────────────────────────────────

const PricingInfoSchema = z.object({
    type: z.enum(['one-time', 'monthly', 'custom']),
    amount: z.number().positive().optional(),
    note: z.string().max(200).optional(),
});

export const ServiceWriteSchema = z.object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'ID must be lowercase slug').max(60),
    name: z.string().trim().min(2).max(100),
    shortDescription: z.string().trim().min(10).max(300),
    longDescription: z.string().trim().min(20).max(2000),
    icon: z.string().max(10),
    timeline: z.string().max(100),
    whoItsFor: z.array(z.string().trim().max(200)).min(1).max(10),
    included: z.array(z.string().trim().max(200)).min(1).max(20),
    pricing: PricingInfoSchema,
    sortOrder: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
});

export type ServiceWrite = z.infer<typeof ServiceWriteSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Solution CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const SolutionWriteSchema = z.object({
    id: z.string().regex(/^[a-z0-9-]+$/).max(60),
    title: z.string().trim().min(2).max(100),
    icon: z.string().max(10),
    description: z.string().trim().min(10).max(500),
    ctaText: z.string().trim().min(2).max(100),
    pains: z.array(z.string().trim().max(300)).min(1).max(10),
    benefits: z.array(z.string().trim().max(300)).min(1).max(10),
    sortOrder: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
});

export type SolutionWrite = z.infer<typeof SolutionWriteSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Pricing Plan CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const PricingPlanWriteSchema = z.object({
    id: z.string().regex(/^[a-z0-9-]+$/).max(60),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().min(10).max(500),
    monthlyPrice: z.number().min(0),
    setupFee: z.number().positive().optional(),
    bestFor: z.string().trim().min(10).max(300),
    ctaText: z.string().trim().min(2).max(50),
    badge: z.string().max(30).optional(),
    isHighlighted: z.boolean().default(false),
    features: z.array(z.string().trim().max(200)).min(1).max(20),
    sortOrder: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
});

export type PricingPlanWrite = z.infer<typeof PricingPlanWriteSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Pricing Add-on CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const PricingAddonWriteSchema = z.object({
    id: z.string().regex(/^[a-z0-9-]+$/).max(60),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().min(10).max(300),
    price: z.number().positive(),
    priceType: z.enum(['one-time', 'monthly']),
    sortOrder: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
});

export type PricingAddonWrite = z.infer<typeof PricingAddonWriteSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Admin: FAQ CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const FAQWriteSchema = z.object({
    id: z.string().regex(/^[a-z0-9-]+$/).max(60),
    question: z.string().trim().min(10).max(300),
    answer: z.string().trim().min(20).max(3000),
    category: z.string().trim().max(50).optional(),
    sortOrder: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
});

export type FAQWrite = z.infer<typeof FAQWriteSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Site Settings CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const NavigationItemSchema = z.object({
    label: z.string().trim().min(1).max(50),
    path: z.string().trim().min(1).max(200),
});

export const SocialLinkSchema = z.object({
    id: z.string().trim().min(1).max(60),
    platform: z.enum(SOCIAL_PLATFORMS),
    label: z.string().trim().max(40).optional().nullable(),
    url: z
        .string()
        .trim()
        .url('Enter a valid URL')
        .refine((v) => v.startsWith('https://'), { message: 'Social links must use https://' }),
    enabled: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
});

export const FooterSectionSchema = z.object({
    title: z.string().trim().max(50),
    links: z.array(NavigationItemSchema).max(10),
});

export const SiteSettingsWriteSchema = z.object({
    brandName: z.string().trim().min(1).max(100),
    brandTagline: z.string().trim().min(1).max(200),
    brandDescription: z.string().trim().max(1000).optional().nullable().default(''),
    contactEmail: z.string().email().max(254),
    // Must already be a fully combined, valid E.164 number (country calling
    // code + national number) — the admin UI's country selector is
    // responsible for combining the two before submit. Uncertain/legacy
    // values are never silently rewritten; invalid input is rejected.
    contactPhone: z
        .string()
        .trim()
        .max(20)
        .optional()
        .nullable()
        .refine((v) => !v || isValidPhoneNumber(v), {
            message: 'Enter a valid international phone number',
        }),
    navigation: z.array(NavigationItemSchema).optional().nullable().default([]),
    footer: z.object({
        sections: z.array(FooterSectionSchema).optional().nullable().default([]),
        socialLinks: z.array(SocialLinkSchema).optional().nullable().default([]),
        copyright: z.string().max(200).optional().nullable().default(''),
    }).optional().nullable().default({ sections: [], socialLinks: [], copyright: '' }),
});

export type SiteSettingsWrite = z.infer<typeof SiteSettingsWriteSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Password Reset
// ─────────────────────────────────────────────────────────────────────────────

export const RequestPasswordResetSchema = z.object({
    email: z.string().trim().email().max(254),
});

export type RequestPasswordReset = z.infer<typeof RequestPasswordResetSchema>;

export const ResetPasswordSchema = z.object({
    token: z.string().trim().min(20).max(200),
    newPassword: z
        .string()
        .min(10, 'Password must be at least 10 characters')
        .max(128)
        .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
            message: 'Password must include both letters and numbers',
        }),
});

export type ResetPassword = z.infer<typeof ResetPasswordSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Change Login Email (requires re-authentication + email verification)
// ─────────────────────────────────────────────────────────────────────────────

export const RequestEmailChangeSchema = z.object({
    currentPassword: z.string().min(8),
    newEmail: z.string().trim().toLowerCase().email().max(254),
});

export type RequestEmailChange = z.infer<typeof RequestEmailChangeSchema>;

export const ConfirmEmailChangeSchema = z.object({
    token: z.string().trim().min(20).max(200),
});

export type ConfirmEmailChange = z.infer<typeof ConfirmEmailChangeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Legal Pages
// ─────────────────────────────────────────────────────────────────────────────

export const LegalPageWriteSchema = z.object({
    title: z.string().trim().min(1).max(150),
    body: z.string().trim().max(50_000),
    isPublished: z.boolean().default(false),
});

export type LegalPageWrite = z.infer<typeof LegalPageWriteSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Query params
// ─────────────────────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['unread', 'read', 'archived', 'all']).default('all'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Payment: Checkout request (client → Worker)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input accepted from the browser to initiate a crypto checkout.
 *
 * IMPORTANT: The client must NEVER supply a price amount, currency conversion
 * rate, callback URL, or success URL. All of those are resolved server-side.
 */
export const CheckoutRequestSchema = z.object({
    /**
     * Internal plan slug (e.g. "starter-bot"). Must match a row in pricing_plans.
     * Validated server-side against the D1 catalog — an unknown key returns 404.
     */
    planKey: z
        .string()
        .trim()
        .min(1, 'Plan is required')
        .max(60, 'Invalid plan key')
        .regex(/^[a-z0-9-]+$/, 'Plan key must be a lowercase slug'),

    /**
     * Crypto currency the customer wants to pay with (e.g. "btc", "usdttrc20").
     * Must be one of the currencies returned by GET /api/v1/payments/currencies.
     */
    payCurrency: z
        .string()
        .trim()
        .min(2, 'Pay currency is required')
        .max(30, 'Invalid pay currency')
        .toLowerCase(),

    /**
     * Billing mode — "one_time" (default for crypto), "setup", or "monthly".
     */
    billingMode: z.enum(['one_time', 'setup', 'monthly']).optional(),
});

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Payment: NOWPayments IPN webhook body (minimal validated shape)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loose schema for the NOWPayments IPN body.
 * Only the fields needed for processing are declared; additional fields
 * from the provider are allowed (passthrough). Signature verification
 * happens on the raw body string BEFORE parsing, so no field is trusted
 * for auth — only for state transitions.
 */
export const WebhookPayloadSchema = z.object({
    payment_id: z.union([z.string(), z.number()]).transform(String),
    order_id: z.string().min(1),
    payment_status: z.string().min(1),
    price_amount: z.number().optional(),
    price_currency: z.string().optional(),
    pay_currency: z.string().optional(),
    actually_paid: z.number().optional(),
    pay_amount: z.number().optional(),
    outcome_amount: z.number().optional(),
    outcome_currency: z.string().optional(),
}).passthrough();

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Payment: Order status query
// ─────────────────────────────────────────────────────────────────────────────

export const OrderStatusQuerySchema = z.object({
    /** Raw status token issued at checkout time for unauthenticated polling. */
    token: z.string().trim().min(1).max(128).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Payment: Admin observability schemas
// ─────────────────────────────────────────────────────────────────────────────

export const AdminPaymentOrdersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum([
        'all',
        'pending',
        'waiting',
        'confirming',
        'partially_paid',
        'paid',
        'failed',
        'expired',
        'refunded',
    ]).default('all'),
    planKey: z.string().trim().max(100).optional(),
    dateFrom: z.string().trim().max(50).optional(),
    dateTo: z.string().trim().max(50).optional(),
    query: z.string().trim().max(100).optional(),
    sortBy: z.enum(['created_at', 'updated_at', 'entitlement_granted_at']).default('created_at'),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type AdminPaymentOrdersQuery = z.infer<typeof AdminPaymentOrdersQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Customer Authentication & Account Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const CustomerRegisterSchema = z.object({
    email: z
        .string()
        .trim()
        .email('Please enter a valid email address')
        .max(254, 'Email must be under 254 characters')
        .toLowerCase(),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password must be under 100 characters'),
    displayName: z
        .string()
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be under 100 characters')
        .optional(),
});

export type CustomerRegisterInput = z.infer<typeof CustomerRegisterSchema>;

export const CustomerLoginSchema = z.object({
    email: z
        .string()
        .trim()
        .email('Please enter a valid email address')
        .max(254, 'Email must be under 254 characters')
        .toLowerCase(),
    password: z
        .string()
        .min(1, 'Password is required')
        .max(100, 'Password must be under 100 characters'),
});

export type CustomerLoginInput = z.infer<typeof CustomerLoginSchema>;

export const CustomerUpdateProfileSchema = z.object({
    displayName: z
        .string()
        .trim()
        .min(1, 'Name cannot be empty')
        .max(100, 'Name must be under 100 characters')
        .optional(),
    avatarUrl: z
        .string()
        .trim()
        .url('Invalid avatar URL')
        .max(500, 'Avatar URL must be under 500 characters')
        .optional()
        .nullable(),
});

export type CustomerUpdateProfileInput = z.infer<typeof CustomerUpdateProfileSchema>;

export const CustomerPasswordResetRequestSchema = z.object({
    email: z
        .string()
        .trim()
        .email('Please enter a valid email address')
        .max(254, 'Email must be under 254 characters')
        .toLowerCase(),
});

export type CustomerPasswordResetRequestInput = z.infer<typeof CustomerPasswordResetRequestSchema>;

export const CustomerPasswordResetConfirmSchema = z.object({
    token: z.string().trim().min(1, 'Token is required').max(128, 'Invalid token'),
    newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password must be under 100 characters'),
});

export type CustomerPasswordResetConfirmInput = z.infer<typeof CustomerPasswordResetConfirmSchema>;

export const CustomerEmailVerificationRequestSchema = z.object({
    email: z
        .string()
        .trim()
        .email('Please enter a valid email address')
        .max(254, 'Email must be under 254 characters')
        .toLowerCase()
        .optional(),
});

export const CustomerEmailVerificationConfirmSchema = z.object({
    token: z.string().trim().min(1, 'Token is required').max(128, 'Invalid token'),
});

export const CustomerPaginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.string().trim().max(50).optional(),
    sortBy: z.enum(['created_at', 'updated_at', 'started_at']).default('created_at'),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type CustomerPaginationQuery = z.infer<typeof CustomerPaginationQuerySchema>;

export const AdminCustomersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    status: z.enum(['all', 'active', 'disabled']).default('all'),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type AdminCustomersQuery = z.infer<typeof AdminCustomersQuerySchema>;


