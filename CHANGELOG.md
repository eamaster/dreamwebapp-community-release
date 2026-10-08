# Changelog

All notable changes to the DreamWebApp Community Edition will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed
- Crypto checkout and public pricing now charge and display CMS-selected fees (positive setup/activation amount, otherwise monthly/access price). Deploy-time catalog seed amounts are never charged.
- Public pricing listing applies a community sale policy so CMS-active alone does not imply public availability or checkout eligibility.
- Plans without a positive payable CMS amount are not listed on the public catalog.
- Frontend checkout CTAs require an explicit `checkoutEligible: true` from the API (fail closed when the field is absent).
- Added reviewed `shared/` modules (`cms-checkout-amount`, `monetary-display`, `checkout-route`) with consistent `@shared` resolution for Vite, TypeScript, Vitest, and Wrangler.

### Security
- Production frontend builds require `VITE_API_BASE_URL` and do not fall back to a built-in API host.
- Customer password-reset links use the operator-configured application origin.
- Google and X OAuth redirect URIs must be configured explicitly. Missing values fail closed.

### Documentation
- Replaced the setup guide with self-hosting instructions for this repository.
- Documented that GitHub Actions runs checks only. Deployment stays opt-in on the operator's own Cloudflare account.
- Licensed the community edition under Apache License 2.0.
- Documented CMS checkout-fee authority and the distinction between CMS active, public visibility, and checkout eligibility.
- Rewrote `worker/README.md` and `CONTRIBUTING.md` for community edition accuracy; corrected OAuth local redirect examples; CI now runs worker `tsc`.

## [0.1.0] - 2026-08-27

### Added
- **Vite + React SPA Frontend**:
  - Modern, responsive landing page, solutions, pricing, contact, and legal pages.
  - Customer self-service portal (dashboard, service provisioning, orders, password management).
  - Admin management portal (CMS editor, lead manager, customer administration).
  - Built with Tailwind CSS, Lucide icons, and accessible UI patterns.
- **Cloudflare Worker API**:
  - Built on Hono framework with structured router architecture.
  - Cloudflare D1 SQL database with versioned migrations (`0001` through `0006`).
  - Cloudflare KV caching layer for dynamic CMS and site settings.
  - Cloudflare R2 bucket binding for media and asset management.
  - Cloudflare Workers AI integration for intelligent chatbot MVP.
- **Crypto Payment Gateway**:
  - Server-authoritative cryptocurrency checkout integration via NOWPayments.
  - Instant Payment Notification (IPN) webhook handler with HMAC-SHA512 verification.
  - Automatic order reconciliation, idempotency controls, and payment return flow.
- **Authentication & Security**:
  - HttpOnly cookie session management backed by D1 session table with active revocation.
  - Double-submit CSRF protection (`X-CSRF-Token` header and domain-scoped cookie).
  - PBKDF2 password hashing for admin and customer credentials.
  - Optional Google OAuth 2.0 and X (Twitter) OAuth 2.0 login flows.
  - Resend email integration for password reset and email verification workflows.
  - Strict input validation using Zod schemas.
- **Developer Experience & CI**:
  - End-to-end Vitest test suite covering API client, CSRF middleware, customer auth, and payments.
  - Strict TypeScript configuration across root and worker packages.
  - ESLint configuration (optional Prettier settings file may be present; Prettier is not a required CI script).
  - GitHub Actions CI workflow executing lint, typecheck, test, and build pipelines.
