/**
 * App-facing Worker env.
 *
 * Bindings and vars come from `wrangler types` (`Cloudflare.Env` in
 * `worker-configuration.d.ts`). Secrets are not declared in wrangler.jsonc, so
 * they are added here: JWT is required; Resend and NOWPayments secrets stay
 * optional so the Worker can fail closed until an operator provisions them.
 *
 * After changing wrangler.jsonc, run `npm run cf-typegen` in `worker/`.
 */
export interface Env extends Cloudflare.Env {
    /** HS256 secret for signing/verifying admin JWTs. Set via: wrangler secret put JWT_SECRET */
    JWT_SECRET: string;
    /** Canonical frontend origin, e.g. https://dreamwebapp.com. Used for verification & email links. */
    PUBLIC_APP_ORIGIN?: string;
    /** Canonical backend API origin, e.g. https://api.dreamwebapp.com */
    API_BASE_URL?: string;
    /** Cookie domain for shared CSRF cookies across subdomains in production, e.g. dreamwebapp.com */
    COOKIE_DOMAIN?: string;
    /**
     * Optional. Set via: wrangler secret put RESEND_API_KEY
     * When absent, the password-reset request endpoint responds with a clear
     * "not available" error instead of claiming an email was sent.
     */
    RESEND_API_KEY?: string;
    /** Optional. Verified Resend sender address. Set via: wrangler secret put RESEND_FROM_EMAIL */
    RESEND_FROM_EMAIL?: string;

    // ── NOWPayments integration ───────────────────────────────────────────────

    /**
     * NOWPayments REST API key.
     * Set via: wrangler secret put NOWPAYMENTS_API_KEY
     * NEVER place in wrangler.jsonc vars or VITE_* frontend env.
     */
    NOWPAYMENTS_API_KEY?: string;

    /**
     * Secret used to verify IPN/webhook HMAC-SHA512 signatures.
     * Set via: wrangler secret put NOWPAYMENTS_IPN_SECRET
     * NEVER expose in logs, error bodies, or frontend bundles.
     */
    NOWPAYMENTS_IPN_SECRET?: string;

    /**
     * NOWPayments API base URL. Defaults to https://api.nowpayments.io/v1.
     * Set as a wrangler var (not a secret) for sandbox override.
     * Example (sandbox): https://api-sandbox.nowpayments.io/v1
     */
    NOWPAYMENTS_API_BASE_URL?: string;

    /** ISO-4217 fiat price currency, e.g. "usd". Defaults to "usd". */
    PAYMENT_PRICE_CURRENCY?: string;

    /**
     * Crypto settlement currency, e.g. "btc" or "usdttrc20".
     * Leave blank to use the NOWPayments account default.
     */
    PAYMENT_OUTCOME_CURRENCY?: string;

    /**
     * Absolute URL NOWPayments will POST IPN updates to.
     * Example: https://api.dreamwebapp.com/api/v1/webhooks/nowpayments
     * For local testing, use an ngrok/cloudflared HTTPS tunnel.
     */
    PAYMENT_IPN_CALLBACK_URL?: string;

    /**
     * URL the customer is redirected to after a successful payment.
     * Example: https://dreamwebapp.com/payment/return
     */
    PAYMENT_SUCCESS_URL?: string;

    /**
     * URL the customer is redirected to after cancelling payment.
     * Example: https://dreamwebapp.com/payment/return
     */
    PAYMENT_CANCEL_URL?: string;

    // ── Customer OAuth Integration ────────────────────────────────────────────

    /** Google OAuth 2.0 Client ID */
    CUSTOMER_AUTH_GOOGLE_CLIENT_ID?: string;
    /** Google OAuth 2.0 Client Secret (set via wrangler secret put) */
    CUSTOMER_AUTH_GOOGLE_CLIENT_SECRET?: string;
    /** Google OAuth 2.0 Redirect URI (e.g. https://dreamwebapp.com/api/v1/auth/oauth/google/callback) */
    CUSTOMER_AUTH_GOOGLE_REDIRECT_URI?: string;

    /** X (Twitter) OAuth 2.0 Client ID */
    CUSTOMER_AUTH_X_CLIENT_ID?: string;
    /** X (Twitter) OAuth 2.0 Client Secret (set via wrangler secret put) */
    CUSTOMER_AUTH_X_CLIENT_SECRET?: string;
    /** X (Twitter) OAuth 2.0 Redirect URI (e.g. https://dreamwebapp.com/api/v1/auth/oauth/x/callback) */
    CUSTOMER_AUTH_X_REDIRECT_URI?: string;
}

