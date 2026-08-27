/**
 * Type-safe environment variable access
 * Provides runtime validation and defaults for environment variables
 */

interface EnvConfig {
    apiBaseUrl: string;
    contactEndpoint: string;
    enableAnalytics: boolean;
    enableChatWidget: boolean;
    gaId?: string;
    gtmId?: string;
}

/**
 * Get environment variable with type safety
 */
function getEnvVar(key: string, defaultValue?: string): string {
    const value = import.meta.env[key];
    if (value === undefined && defaultValue === undefined) {
        console.warn(`Environment variable ${key} is not defined`);
        return '';
    }
    return value || defaultValue || '';
}

/**
 * Parse boolean environment variable
 */
function getBooleanEnv(key: string, defaultValue: boolean = false): boolean {
    const value = import.meta.env[key];
    if (value === undefined) return defaultValue;
    return value === 'true' || value === '1';
}

/**
 * Validates and normalizes the API base URL.
 * In production:
 * - Must be valid HTTPS URL.
 * - Must not contain credentials (username/password).
 * - Must not contain query parameters or fragments.
 * - Must not contain an unexpected pathname.
 * - Any workers.dev hostname is strictly rejected.
 * In development:
 * - Defaults to http://localhost:8787.
 */
export function getValidatedApiBaseUrl(
    rawInput?: string,
    isProdEnv: boolean = import.meta.env.PROD
): string {
    const rawUrl =
        rawInput !== undefined
            ? rawInput
            : (import.meta.env.VITE_API_BASE_URL || (isProdEnv ? 'https://api.dreamwebapp.com' : 'http://localhost:8787'));

    if (!rawUrl || typeof rawUrl !== 'string') {
        throw new Error('[env] VITE_API_BASE_URL must be a non-empty string.');
    }

    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error(`[env] Invalid VITE_API_BASE_URL format: "${rawUrl}". Must be a valid URL.`);
    }

    if (parsed.username || parsed.password) {
        throw new Error('[env] VITE_API_BASE_URL must not include credentials.');
    }

    if (parsed.search || parsed.hash) {
        throw new Error('[env] VITE_API_BASE_URL must not contain query parameters or fragments.');
    }

    if (parsed.pathname && parsed.pathname !== '/') {
        throw new Error(`[env] VITE_API_BASE_URL must not include a path component: "${parsed.pathname}".`);
    }

    if (parsed.hostname.endsWith('.workers' + '.dev') || parsed.hostname === 'workers.dev') {
        throw new Error(`[env] Obsolete workers.dev hostname rejected: "${parsed.hostname}".`);
    }

    if (isProdEnv) {
        if (parsed.protocol !== 'https:') {
            throw new Error(`[env] Production API base URL must use HTTPS: "${rawUrl}".`);
        }
    }

    return parsed.origin;
}

/**
 * Application environment configuration
 */
export const env: EnvConfig = {
    // In development: Worker runs on http://localhost:8787 (wrangler dev)
    // In production:  HTTPS API endpoint (from VITE_API_BASE_URL or default)
    apiBaseUrl: getValidatedApiBaseUrl(),
    contactEndpoint: getEnvVar('VITE_CONTACT_ENDPOINT', '/api/v1/contact'),
    enableAnalytics: getBooleanEnv('VITE_ENABLE_ANALYTICS', false),
    // Chat widget MVP ships enabled by default; set VITE_ENABLE_CHAT_WIDGET=false to kill-switch it.
    enableChatWidget: getBooleanEnv('VITE_ENABLE_CHAT_WIDGET', true),
    gaId: import.meta.env.VITE_GA_ID,
    gtmId: import.meta.env.VITE_GTM_ID,
};

/**
 * Check if running in development mode
 */
export const isDev = import.meta.env.DEV;

/**
 * Check if running in production mode
 */
export const isProd = import.meta.env.PROD;

/**
 * Log environment configuration in development
 */
if (isDev) {
    console.log('Environment Configuration:', {
        mode: import.meta.env.MODE,
        apiBaseUrl: env.apiBaseUrl,
        enableAnalytics: env.enableAnalytics,
    });
}
