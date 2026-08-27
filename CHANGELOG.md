# Changelog

All notable changes to the DreamWebApp Community Edition will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
  - ESLint configuration and Prettier code formatting.
  - GitHub Actions CI workflow executing lint, typecheck, test, and build pipelines.
