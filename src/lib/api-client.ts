/**
 * Typed API client for the DreamWebApp Worker API.
 *
 * All fetchers return strongly-typed data matching the DB schema output shapes.
 * On network or API errors, they throw an `ApiError` so React Query can handle retries.
 */

import { env } from '@/config/env';

// ─── Types (mirror the Worker's response shapes) ──────────────────────────────

export interface NavigationItem { label: string; path: string }

export type SocialPlatform =
    | 'twitter' | 'linkedin' | 'facebook' | 'instagram'
    | 'youtube' | 'tiktok' | 'github' | 'other';

export interface SocialLink {
    id: string;
    platform: SocialPlatform;
    label?: string;
    url: string;
    enabled: boolean;
    sortOrder: number;
}

export interface FooterSection { title: string; links: NavigationItem[] }

export interface SiteData {
    brand: {
        name: string;
        tagline: string;
        description: string;
        /** Absolute-relative URL (prefix with apiBaseUrl) or null to use the built-in fallback logo. */
        headerLogoUrl?: string | null;
        footerLogoUrl?: string | null;
    };
    navigation: NavigationItem[];
    footer: { sections: FooterSection[]; socialLinks: SocialLink[]; copyright: string };
    /** `phone` is canonically E.164 (e.g. "+15551234567") once saved via the admin CMS. */
    contact: { email: string; phone?: string | null };
}

export interface LegalPageData {
    id: 'privacy-policy' | 'terms-of-service';
    title: string;
    body: string;
    updatedAt: string;
}

export interface LegalPageAdminData extends LegalPageData {
    isPublished: boolean;
}

export interface ServicePricing {
    type: 'one-time' | 'monthly' | 'custom';
    amount?: number;
    note?: string;
}

export interface ServiceData {
    id: string;
    name: string;
    shortDescription: string;
    longDescription: string;
    icon: string;
    timeline: string;
    whoItsFor: string[];
    included: string[];
    pricing: ServicePricing;
    sortOrder: number;
}

export interface SolutionData {
    id: string;
    title: string;
    icon: string;
    description: string;
    ctaText: string;
    pains: string[];
    benefits: string[];
}

export interface PricingPlanData {
    id: string;
    name: string;
    description: string;
    monthlyPrice: number;
    setupFee?: number | null;
    bestFor: string;
    ctaText: string;
    badge?: string | null;
    highlighted: boolean;
    features: string[];
}

export interface PricingAddonData {
    id: string;
    name: string;
    description: string;
    price: number;
    priceType: 'one-time' | 'monthly';
}

export interface PricingData {
    plans: PricingPlanData[];
    addons: PricingAddonData[];
}

export interface FAQItem {
    id: string;
    question: string;
    answer: string;
    category?: string | null;
}

export interface ContactPayload {
    name: string;
    email: string;
    businessType: string;
    website?: string;
    /** Optional, canonically E.164 (e.g. "+15551234567") when supplied. */
    phone?: string;
    message: string;
    /** Where this lead originated. Defaults server-side to 'contact_page'. */
    source?: 'contact_page' | 'chatbot';
}

export interface ContactResponse {
    success: boolean;
    id: number;
    message: string;
}

// ─── AI Chat ───────────────────────────────────────────────────────────────

export interface ChatMessagePayload {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatRequestPayload {
    messages: ChatMessagePayload[];
}

export interface ChatAction {
    type: 'handoff' | 'contact';
    label: string;
    path: string;
}

export interface ChatResponse {
    success: boolean;
    reply: string;
    action?: ChatAction;
    /** True when the AI provider was unavailable and a deterministic fallback was used. */
    degraded?: boolean;
}

// ─── Error type ──────────────────────────────────────────────────────────────

export interface ApiError {
    name: 'ApiError';
    status: number;
    message: string;
    fields?: Record<string, string[]>;
}

export function createApiError(
    status: number,
    message: string,
    fields?: Record<string, string[]>
): ApiError {
    return { name: 'ApiError', status, message, fields };
}

export function isApiError(err: unknown): err is ApiError {
    return typeof err === 'object' && err !== null && (err as ApiError).name === 'ApiError';
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface ApiResponse<T> {
    data: T;
    timestamp: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${env.apiBaseUrl}${path}`;

    let res: Response;
    try {
        res = await fetch(url, {
            // Public content changes as soon as an admin save completes (the
            // Worker invalidates its KV cache before responding). The Worker's
            // `Cache-Control: max-age=...` is meant for shared/CDN caches, but
            // the browser's own disk cache also honors it on a plain `fetch`,
            // which would silently serve pre-edit content for minutes after a
            // save. `no-cache` forces revalidation with the server on every
            // request (not `no-store` — CDN/shared caching is left intact).
            cache: 'no-cache',
            ...init,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...init?.headers,
            },
        });
    } catch (err) {
        throw createApiError(0, `Network error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    if (!res.ok) {
        let errorBody: { error?: string; fields?: Record<string, string[]> } = {};
        try { errorBody = await res.json(); } catch { /* empty body */ }
        throw createApiError(
            res.status,
            errorBody.error ?? `API error ${res.status}`,
            errorBody.fields
        );
    }

    const body = (await res.json()) as ApiResponse<T>;
    return body.data;
}

// ─── Public Content Fetchers ──────────────────────────────────────────────────

export const fetchSite = (): Promise<SiteData> =>
    apiFetch<SiteData>('/api/v1/content/site');

export const fetchServices = (): Promise<ServiceData[]> =>
    apiFetch<ServiceData[]>('/api/v1/content/services');

export const fetchSolutions = (): Promise<SolutionData[]> =>
    apiFetch<SolutionData[]>('/api/v1/content/solutions');

export const fetchPricing = (): Promise<PricingData> =>
    apiFetch<PricingData>('/api/v1/content/pricing');

export const fetchFAQ = (): Promise<FAQItem[]> =>
    apiFetch<FAQItem[]>('/api/v1/content/faq');

export const fetchLegalPage = (id: 'privacy-policy' | 'terms-of-service'): Promise<LegalPageData | null> =>
    apiFetch<LegalPageData | null>(`/api/v1/content/legal/${id}`);

// ─── Lead Capture ─────────────────────────────────────────────────────────────

export async function submitContact(payload: ContactPayload): Promise<ContactResponse> {
    const url = `${env.apiBaseUrl}/api/v1/contact`;

    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (err) {
        throw createApiError(0, `Network error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    const body = await res.json() as Record<string, unknown>;

    if (!res.ok) {
        throw createApiError(
            res.status,
            (body['error'] as string) ?? `Error ${res.status}`,
            body['fields'] as Record<string, string[]> | undefined
        );
    }

    return body as unknown as ContactResponse;
}

export async function sendChatMessage(payload: ChatRequestPayload, signal?: AbortSignal): Promise<ChatResponse> {
    const url = `${env.apiBaseUrl}/api/v1/chat`;

    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload),
            signal,
        });
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw createApiError(0, 'Request was cancelled.');
        }
        throw createApiError(0, `Network error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    let body: Record<string, unknown>;
    try {
        body = (await res.json()) as Record<string, unknown>;
    } catch {
        throw createApiError(res.status, 'Received an invalid response from the server.');
    }

    if (!res.ok) {
        throw createApiError(
            res.status,
            (body['error'] as string) ?? `Error ${res.status}`,
            body['fields'] as Record<string, string[]> | undefined
        );
    }

    return body as unknown as ChatResponse;
}

// ─── Admin CMS API ────────────────────────────────────────────────────────────

const TOKEN_STORAGE_KEY = 'dreamwebapp_admin_token';

export function getStoredAdminToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredAdminToken(token: string | null): void {
    if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
}

export interface AdminLoginResponse {
    token: string;
    expiresIn: number;
}

export async function adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
    const url = `${env.apiBaseUrl}/api/v1/admin/auth/login`;
    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
    } catch (err) {
        throw createApiError(0, `Network error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) {
        throw createApiError(
            res.status,
            (body['error'] as string) ?? 'Authentication failed'
        );
    }
    const token = body['token'] as string;
    setStoredAdminToken(token);
    return { token, expiresIn: body['expiresIn'] as number };
}

export interface GenericMessageResponse {
    success: boolean;
    message: string;
}

export async function requestPasswordReset(email: string): Promise<GenericMessageResponse> {
    const url = `${env.apiBaseUrl}/api/v1/admin/auth/request-reset`;
    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ email }),
        });
    } catch (err) {
        throw createApiError(0, `Network error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) {
        throw createApiError(res.status, (body['error'] as string) ?? 'Unable to request a password reset.');
    }
    return body as unknown as GenericMessageResponse;
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<GenericMessageResponse> {
    const url = `${env.apiBaseUrl}/api/v1/admin/auth/reset-password`;
    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ token, newPassword }),
        });
    } catch (err) {
        throw createApiError(0, `Network error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) {
        throw createApiError(res.status, (body['error'] as string) ?? 'Unable to reset your password.');
    }
    return body as unknown as GenericMessageResponse;
}

export async function adminRequestEmailChange(currentPassword: string, newEmail: string): Promise<GenericMessageResponse> {
    return adminFetch<GenericMessageResponse>('/api/v1/admin/account/change-email/request', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newEmail }),
    });
}

export async function confirmEmailChange(token: string): Promise<GenericMessageResponse> {
    const url = `${env.apiBaseUrl}/api/v1/admin/account/change-email/confirm`;
    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ token }),
        });
    } catch (err) {
        throw createApiError(0, `Network error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) {
        throw createApiError(res.status, (body['error'] as string) ?? 'Unable to confirm this email change.');
    }
    return body as unknown as GenericMessageResponse;
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = getStoredAdminToken();
    const url = `${env.apiBaseUrl}${path}`;

    let res: Response;
    try {
        res = await fetch(url, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                ...init?.headers,
            },
        });
    } catch (err) {
        throw createApiError(0, `Network error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    if (res.status === 401) {
        setStoredAdminToken(null);
        throw createApiError(401, 'Session expired. Please log in again.');
    }

    if (!res.ok) {
        let errorBody: { error?: string; fields?: Record<string, string[]> } = {};
        try { errorBody = await res.json(); } catch { /* empty */ }
        throw createApiError(
            res.status,
            errorBody.error ?? `Admin API error ${res.status}`,
            errorBody.fields
        );
    }

    const body = (await res.json()) as { data?: T; success?: boolean; id?: unknown };
    return (body.data !== undefined ? body.data : body) as T;
}

export interface ContactMessage {
    id: number;
    name: string;
    email: string;
    businessType: string;
    website?: string | null;
    phone?: string | null;
    message: string;
    status: 'unread' | 'read' | 'archived';
    createdAt: string;
    updatedAt: string;
}

// Admin Contacts
export const adminGetContacts = (status?: string): Promise<ContactMessage[]> =>
    adminFetch<ContactMessage[]>(`/api/v1/admin/contacts${status ? `?status=${status}` : ''}`);

export const adminUpdateContactStatus = (id: number, status: 'unread' | 'read' | 'archived'): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/contacts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    });

// Admin Services
export const adminGetServices = (): Promise<ServiceData[]> =>
    adminFetch<ServiceData[]>('/api/v1/admin/services');

export const adminSaveService = (service: ServiceData, isNew: boolean): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/services${isNew ? '' : `/${service.id}`}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(service),
    });

export const adminDeleteService = (id: string): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/services/${id}`, { method: 'DELETE' });

// Admin Solutions
export const adminGetSolutions = (): Promise<SolutionData[]> =>
    adminFetch<SolutionData[]>('/api/v1/admin/solutions');

export const adminSaveSolution = (solution: SolutionData, isNew: boolean): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/solutions${isNew ? '' : `/${solution.id}`}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(solution),
    });

export const adminDeleteSolution = (id: string): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/solutions/${id}`, { method: 'DELETE' });

// Admin Pricing Plans & Addons
export const adminGetPricingPlans = (): Promise<PricingPlanData[]> =>
    adminFetch<PricingPlanData[]>('/api/v1/admin/pricing/plans');

export const adminSavePricingPlan = (plan: PricingPlanData, isNew: boolean): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/pricing/plans${isNew ? '' : `/${plan.id}`}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(plan),
    });

export const adminDeletePricingPlan = (id: string): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/pricing/plans/${id}`, { method: 'DELETE' });

export const adminGetPricingAddons = (): Promise<PricingAddonData[]> =>
    adminFetch<PricingAddonData[]>('/api/v1/admin/pricing/addons');

export const adminSavePricingAddon = (addon: PricingAddonData, isNew: boolean): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/pricing/addons${isNew ? '' : `/${addon.id}`}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(addon),
    });

export const adminDeletePricingAddon = (id: string): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/pricing/addons/${id}`, { method: 'DELETE' });

// Admin FAQs
export const adminGetFAQs = (): Promise<FAQItem[]> =>
    adminFetch<FAQItem[]>('/api/v1/admin/faq');

export const adminSaveFAQ = (faq: FAQItem, isNew: boolean): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/faq${isNew ? '' : `/${faq.id}`}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(faq),
    });

export const adminDeleteFAQ = (id: string): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/faq/${id}`, { method: 'DELETE' });

// Admin Site Settings
export const adminGetSiteSettings = (): Promise<SiteData> =>
    adminFetch<SiteData>('/api/v1/admin/site');

export const adminSaveSiteSettings = (site: SiteData): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>('/api/v1/admin/site', {
        method: 'PUT',
        body: JSON.stringify({
            brandName: site.brand.name,
            brandTagline: site.brand.tagline,
            brandDescription: site.brand.description,
            contactEmail: site.contact.email,
            contactPhone: site.contact.phone,
            navigation: site.navigation,
            footer: site.footer,
        }),
    });

// Admin capability status — which optional integrations (email, storage) are
// actually configured. Booleans only; never leaks provider details/secrets.
export interface AdminCapabilities {
    logoStorageConfigured: boolean;
    passwordResetEmailConfigured: boolean;
}

export const adminGetCapabilities = (): Promise<AdminCapabilities> =>
    adminFetch<AdminCapabilities>('/api/v1/admin/capabilities');

// Admin Legal Pages
export const adminGetLegalPages = (): Promise<LegalPageAdminData[]> =>
    adminFetch<LegalPageAdminData[]>('/api/v1/admin/legal');

export const adminSaveLegalPage = (
    id: 'privacy-policy' | 'terms-of-service',
    data: { title: string; body: string; isPublished: boolean }
): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/legal/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });

// Admin Logo Assets
export type LogoTarget = 'header' | 'footer';

export async function adminUploadLogo(target: LogoTarget, file: File): Promise<{ success: boolean; url: string }> {
    const token = getStoredAdminToken();
    const url = `${env.apiBaseUrl}/api/v1/admin/assets/logo?target=${target}`;

    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': file.type,
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: file,
        });
    } catch (err) {
        throw createApiError(0, `Network error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) {
        throw createApiError(res.status, (body['error'] as string) ?? 'Failed to upload logo.');
    }
    return body as unknown as { success: boolean; url: string };
}

export const adminRemoveLogo = (target: LogoTarget): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/assets/logo?target=${target}`, { method: 'DELETE' });

// ─── Payment / Crypto Checkout ────────────────────────────────────────────────

/**
 * Normalized internal payment status (mirrors worker/src/lib/payments/types.ts).
 * Must stay in sync with the Worker's InternalPaymentStatus union.
 */
export type PaymentStatus =
    | 'pending'
    | 'waiting'
    | 'confirming'
    | 'partially_paid'
    | 'paid'
    | 'failed'
    | 'expired'
    | 'refunded';

export interface CheckoutRequest {
    planKey: string;
    payCurrency: string;
    billingMode?: 'one_time' | 'setup' | 'monthly';
}

export interface CheckoutResponse {
    orderId: string;
    /** Raw status token — store this to poll order status without authentication. */
    statusToken: string;
    /** URL to redirect the customer to for payment. */
    invoiceUrl: string;
}

export interface OrderStatusResponse {
    orderId: string;
    planKey: string;
    billingMode: 'one_time' | 'setup' | 'monthly';
    status: PaymentStatus;
    statusLabel: string;
    priceAmount: string;
    priceCurrency: string;
    payCurrency: string;
    payAmount: string | null;
    isPaid: boolean;
    isTerminal: boolean;
    updatedAt: string;
    entitlementGrantedAt: string | null;
}

export type PaymentCurrencyCategory = 'popular' | 'stablecoins';

export interface PaymentCurrencyData {
    code: string;
    symbol: string;
    name: string;
    network?: string;
    label: string;
    category: PaymentCurrencyCategory;
}

/**
 * Validates that an invoice URL received from the Worker checkout endpoint
 * is a valid HTTPS URL strictly constrained to trusted NOWPayments invoice origins.
 */
const ALLOWED_NOWPAYMENTS_HOSTS: ReadonlySet<string> = new Set<string>([
    'nowpayments.io',
    'api.nowpayments.io',
    'checkout.nowpayments.io',
    'sandbox.nowpayments.io',
]);

export function isValidNowPaymentsInvoiceUrl(urlStr?: string | null): boolean {
    if (!urlStr || typeof urlStr !== 'string') return false;
    try {
        const parsed = new URL(urlStr);
        if (parsed.protocol !== 'https:') return false;
        return ALLOWED_NOWPAYMENTS_HOSTS.has(parsed.hostname.toLowerCase());
    } catch {
        return false;
    }
}

/**
 * Fetches the list of supported crypto currencies from the backend.
 * The backend caches this for 10 minutes in KV.
 */
export async function fetchPaymentCurrencies(): Promise<PaymentCurrencyData[]> {
    return apiFetch<PaymentCurrencyData[]>('/api/v1/payments/currencies');
}

/**
 * Initiates an authenticated crypto checkout for the given plan and pay currency.
 * Only trusted inputs are accepted — never supply a price amount from the browser.
 */
export async function createCheckout(payload: CheckoutRequest): Promise<CheckoutResponse> {
    return customerFetch<CheckoutResponse>('/api/v1/payments/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

/**
 * Fetches the canonical order status from the backend.
 * Requires the `token` returned at checkout time for unauthenticated polling.
 */
export async function fetchOrderStatus(orderId: string, statusToken: string): Promise<OrderStatusResponse> {
    return apiFetch<OrderStatusResponse>(
        `/api/v1/payments/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(statusToken)}`
    );
}

// ─── Admin Payments Observability ─────────────────────────────────────────────

export interface AdminPaymentOrderDto {
    orderId: string;
    createdAt: string;
    updatedAt: string;
    planKey: string;
    planName: string;
    billingMode: 'one_time' | 'setup' | 'monthly';
    internalStatus: 'pending' | 'waiting' | 'confirming' | 'partially_paid' | 'paid' | 'failed' | 'expired' | 'refunded';
    priceAmountDecimal: string;
    priceCurrency: string;
    payCurrency: string;
    providerInvoiceId: string | null;
    providerStatus: string | null;
    entitlementGrantedAt: string | null;
    eventCount: number;
}

export interface AdminPaymentEventDto {
    id: number;
    orderId: string;
    providerStatus: string;
    providerPaymentId: string;
    receivedAt: string;
}

export interface AdminPaymentDetailDto {
    order: AdminPaymentOrderDto;
    events: AdminPaymentEventDto[];
}

export interface AdminPaymentSummaryDto {
    totalOrders: number;
    byStatus: Record<string, number>;
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    paidRevenueByCurrency: Record<string, string>;
}

export interface AdminPaymentOrdersQuery {
    page?: number;
    pageSize?: number;
    status?: string;
    planKey?: string;
    dateFrom?: string;
    dateTo?: string;
    query?: string;
    sortBy?: 'created_at' | 'updated_at' | 'entitlement_granted_at';
    sortDir?: 'asc' | 'desc';
}

export interface AdminPaymentOrdersResponse {
    items: AdminPaymentOrderDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export const adminGetPaymentOrders = (query?: AdminPaymentOrdersQuery): Promise<AdminPaymentOrdersResponse> => {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', String(query.page));
    if (query?.pageSize) params.set('pageSize', String(query.pageSize));
    if (query?.status && query.status !== 'all') params.set('status', query.status);
    if (query?.planKey) params.set('planKey', query.planKey);
    if (query?.dateFrom) params.set('dateFrom', query.dateFrom);
    if (query?.dateTo) params.set('dateTo', query.dateTo);
    if (query?.query) params.set('query', query.query);
    if (query?.sortBy) params.set('sortBy', query.sortBy);
    if (query?.sortDir) params.set('sortDir', query.sortDir);

    const queryString = params.toString();
    return adminFetch<AdminPaymentOrdersResponse>(`/api/v1/admin/payments/orders${queryString ? `?${queryString}` : ''}`);
};

export const adminGetPaymentOrderDetail = (orderId: string): Promise<AdminPaymentDetailDto> =>
    adminFetch<AdminPaymentDetailDto>(`/api/v1/admin/payments/orders/${encodeURIComponent(orderId)}`);

export const adminGetPaymentSummary = (): Promise<AdminPaymentSummaryDto> =>
    adminFetch<AdminPaymentSummaryDto>('/api/v1/admin/payments/summary');

// ─── Admin Customers API ──────────────────────────────────────────────────────

export interface AdminCustomerDto {
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

export interface AdminCustomersQuery {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: 'all' | 'active' | 'disabled';
    sortDir?: 'asc' | 'desc';
}

export interface AdminCustomerPaginatedResponse {
    items: AdminCustomerDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface AdminSchemaHealthDto {
    ok: boolean;
    missingTables: string[];
    tables: Record<string, boolean>;
}

export const adminGetCustomers = (params?: AdminCustomersQuery): Promise<AdminCustomerPaginatedResponse> => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    if (params?.search) q.set('search', params.search);
    if (params?.status && params.status !== 'all') q.set('status', params.status);
    if (params?.sortDir) q.set('sortDir', params.sortDir);
    const qs = q.toString();
    return adminFetch<AdminCustomerPaginatedResponse>(`/api/v1/admin/customers${qs ? `?${qs}` : ''}`);
};

export const adminGetCustomerDetail = (customerId: string): Promise<AdminCustomerDetailDto> =>
    adminFetch<AdminCustomerDetailDto>(`/api/v1/admin/customers/${encodeURIComponent(customerId)}`);

export const adminSetCustomerDisabled = (customerId: string, disabled: boolean): Promise<{ success: boolean }> =>
    adminFetch<{ success: boolean }>(`/api/v1/admin/customers/${encodeURIComponent(customerId)}/${disabled ? 'disable' : 'enable'}`, {
        method: 'POST',
    });

export const adminGetSchemaHealth = (): Promise<AdminSchemaHealthDto> =>
    adminFetch<AdminSchemaHealthDto>('/api/v1/admin/health/schema');

// ─── Customer Authentication & Account API ────────────────────────────────────

export function getCsrfTokenFromCookie(): string | null {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [k, ...v] = cookie.trim().split('=');
        if (k === 'dreamwebapp_csrf') {
            return decodeURIComponent(v.join('='));
        }
    }
    return null;
}

export async function customerFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${env.apiBaseUrl}${path}`;
    const method = (init?.method || 'GET').toUpperCase();
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    const csrfToken = isStateChanging ? getCsrfTokenFromCookie() : null;

    let res: Response;
    try {
        res = await fetch(url, {
            ...init,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
                ...init?.headers,
            },
        });
    } catch (err) {
        throw createApiError(0, `Network error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    if (res.status === 401) {
        throw createApiError(401, 'Authentication required. Please sign in.');
    }

    if (!res.ok) {
        let errorBody: { error?: string; fields?: Record<string, string[]> } = {};
        try {
            errorBody = (await res.json()) as typeof errorBody;
        } catch {
            /* empty body */
        }
        throw createApiError(
            res.status,
            errorBody.error ?? `API error ${res.status}`,
            errorBody.fields,
        );
    }

    const body = (await res.json()) as { data?: unknown; success?: boolean; user?: unknown };
    if (body && typeof body === 'object' && 'data' in body && body.data !== undefined) {
        return body.data as T;
    }
    return body as T;
}

export interface CustomerUser {
    id: string;
    email: string | null;
    emailVerified: boolean;
    displayName: string | null;
    avatarUrl: string | null;
    createdAt: string;
}

export interface CustomerCapabilities {
    google: boolean;
    x: boolean;
    emailAuth: boolean;
}

export interface CustomerServiceDto {
    id: string;
    orderId: string;
    planKey: string;
    serviceName: string;
    status: 'active' | 'provisioning' | 'completed' | 'suspended' | 'cancelled';
    startedAt: string;
    expiresAt: string | null;
    nextReviewAt: string | null;
    createdAt: string;
}

export interface CustomerServiceDetailResponse {
    service: CustomerServiceDto;
    order: {
        orderId: string;
        priceAmountDecimal: string;
        priceCurrency: string;
        payCurrency: string;
        internalStatus: string;
        entitlementGrantedAt: string | null;
        createdAt: string;
    } | null;
}

export interface CustomerPaymentOrderDto {
    orderId: string;
    planKey: string;
    planName: string;
    billingMode: 'one_time' | 'setup' | 'monthly';
    priceAmountDecimal: string;
    priceCurrency: string;
    payCurrency: string;
    internalStatus: string;
    providerStatus: string | null;
    entitlementGrantedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CustomerPaymentDetailResponse {
    order: CustomerPaymentOrderDto & {
        expectedPayAmountDecimal: string | null;
        providerInvoiceId: string | null;
    };
    service: {
        id: string;
        serviceName: string;
        status: string;
        startedAt: string;
    } | null;
}

export interface CustomerPaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// ── Auth Endpoints ──

export const customerGetCapabilities = (): Promise<CustomerCapabilities> =>
    customerFetch<CustomerCapabilities>('/api/v1/auth/capabilities');

export const customerRegister = (data: { email: string; password: string; displayName?: string }): Promise<{ success: boolean; user: CustomerUser }> =>
    customerFetch<{ success: boolean; user: CustomerUser }>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const customerLogin = (data: { email: string; password: string }): Promise<{ success: boolean; user: CustomerUser }> =>
    customerFetch<{ success: boolean; user: CustomerUser }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const customerLogout = (): Promise<{ success: boolean }> =>
    customerFetch<{ success: boolean }>('/api/v1/auth/logout', { method: 'POST' });

export const customerGetMe = (): Promise<CustomerUser> =>
    customerFetch<CustomerUser>('/api/v1/auth/me');

export const customerUpdateProfile = (data: { displayName?: string; avatarUrl?: string | null }): Promise<{ success: boolean; user: CustomerUser }> =>
    customerFetch<{ success: boolean; user: CustomerUser }>('/api/v1/auth/me', {
        method: 'PUT',
        body: JSON.stringify(data),
    });

export const customerRequestPasswordReset = (email: string): Promise<GenericMessageResponse> =>
    customerFetch<GenericMessageResponse>('/api/v1/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
    });

export const customerConfirmPasswordReset = (token: string, newPassword: string): Promise<GenericMessageResponse> =>
    customerFetch<GenericMessageResponse>('/api/v1/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
    });

export const customerConfirmEmailVerification = (token: string): Promise<{ success: boolean; message: string; email?: string }> =>
    customerFetch<{ success: boolean; message: string; email?: string }>('/api/v1/auth/email-verification/confirm', {
        method: 'POST',
        body: JSON.stringify({ token }),
    });

export const customerResendEmailVerification = (): Promise<{ success: boolean; message: string }> =>
    customerFetch<{ success: boolean; message: string }>('/api/v1/auth/email-verification/resend', {
        method: 'POST',
    });

// ── Account Endpoints ──

export interface CustomerDeletionEligibility {
    eligible: boolean;
    reason?: 'blocked_active_service' | 'blocked_paid_order_history';
    details?: string;
}

export const customerGetDeletionEligibility = (): Promise<CustomerDeletionEligibility> =>
    customerFetch<CustomerDeletionEligibility>('/api/v1/account/deletion-eligibility');

export const customerDeleteAccount = (): Promise<{ success: boolean; message: string }> =>
    customerFetch<{ success: boolean; message: string }>('/api/v1/account/me', {
        method: 'DELETE',
    });

export const customerGetServices = (params?: { page?: number; pageSize?: number; status?: string }): Promise<CustomerPaginatedResponse<CustomerServiceDto>> => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    if (params?.status && params.status !== 'all') q.set('status', params.status);
    const qs = q.toString();
    return customerFetch<CustomerPaginatedResponse<CustomerServiceDto>>(`/api/v1/account/services${qs ? `?${qs}` : ''}`);
};

export const customerGetServiceDetail = (serviceId: string): Promise<CustomerServiceDetailResponse> =>
    customerFetch<CustomerServiceDetailResponse>(`/api/v1/account/services/${encodeURIComponent(serviceId)}`);

export const customerGetPayments = (params?: { page?: number; pageSize?: number; status?: string }): Promise<CustomerPaginatedResponse<CustomerPaymentOrderDto>> => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    if (params?.status && params.status !== 'all') q.set('status', params.status);
    const qs = q.toString();
    return customerFetch<CustomerPaginatedResponse<CustomerPaymentOrderDto>>(`/api/v1/account/payments${qs ? `?${qs}` : ''}`);
};

export const customerGetPaymentDetail = (orderId: string): Promise<CustomerPaymentDetailResponse> =>
    customerFetch<CustomerPaymentDetailResponse>(`/api/v1/account/payments/${encodeURIComponent(orderId)}`);



