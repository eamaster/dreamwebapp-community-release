# DreamWebApp — Full-Stack AI Automation Platform & Marketing Site

A production-grade, edge-native web application deployed on the Cloudflare global network (**Cloudflare Pages** + **Cloudflare Workers** + **Cloudflare D1** + **Cloudflare KV** + **Cloudflare R2** + **Cloudflare Workers AI**) with automated CI/CD via **GitHub Actions**.

---

## 📑 Table of Contents

1. [Architecture Overview](#-architecture-overview)
2. [Key Features](#-key-features)
3. [Project Directory Structure](#-project-directory-structure)
4. [Local Development Setup](#-local-development-setup)
   - [Prerequisites](#prerequisites)
   - [Installation](#1-installation)
   - [Environment Variables](#2-environment-variables)
   - [Running Backend API Locally](#3-running-backend-api-locally-cloudflare-worker)
   - [Running Frontend Locally](#4-running-frontend-locally-vite)
5. [Configuration & Credentials Reference](#-configuration--credentials-reference-private-repo)
6. [Visual Admin CMS Portal](#-visual-admin-cms-portal)
7. [Customer Authentication & Account System](#-customer-authentication--account-system)
8. [AI Chat Assistant](#-ai-chat-assistant)
9. [NOWPayments Cryptocurrency Checkout](#-nowpayments-cryptocurrency-checkout)
10. [Multi-Tier Caching & Invalidation](#-multi-tier-caching--invalidation)
11. [API Endpoints Reference](#-api-endpoints-reference)
12. [Frontend Routes](#-frontend-routes)
13. [Automated CI/CD Workflows (GitHub Actions)](#-automated-cicd-workflows-github-actions)
14. [Complete Production Deployment Guide](#-complete-production-deployment-guide)
    - [Part 1: Deploy Backend Worker (D1 + KV + Secrets)](#part-1-deploy-backend-worker-d1--kv--secrets)
    - [Part 2: Deploy Frontend on Cloudflare Pages](#part-2-deploy-frontend-on-cloudflare-pages)
    - [Part 3: Custom Domains & SSL Setup](#part-3-custom-domains--ssl-setup)
    - [Post-Deployment Verification Checklist](#post-deployment-verification-checklist)
15. [Critical Architecture Rules & Gotchas](#-critical-architecture-rules--gotchas)
16. [NPM Scripts Reference](#-npm-scripts-reference)
17. [Tech Stack](#-tech-stack)
18. [License](#-license)

---


---

## ⚡ Quick Start (Community Edition)

Get DreamWebApp running locally in under 3 minutes:

### Prerequisites
- **Node.js**: v22.x LTS or higher
- **npm**: v10.x or higher

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-org/dreamwebapp-community.git
cd dreamwebapp-community

# Install frontend dependencies
npm ci

# Install Worker backend dependencies
npm ci --prefix worker
```

### 2. Configure Environment Files
```bash
# Frontend environment
cp .env.example .env

# Worker environment & secrets
cp worker/.dev.vars.example worker/.dev.vars
```

### 3. Initialize Local D1 Database & Migrations
```bash
cd worker
npx wrangler d1 execute DB --local --file=./migrations/0001_initial.sql
npx wrangler d1 execute DB --local --file=./migrations/0002_admin_security_and_cms.sql
npx wrangler d1 execute DB --local --file=./migrations/0003_contact_phone.sql
npx wrangler d1 execute DB --local --file=./migrations/0004_admin_account_email_change.sql
npx wrangler d1 execute DB --local --file=./migrations/0005_payment_orders.sql
npx wrangler d1 execute DB --local --file=./migrations/0006_customer_accounts_and_services.sql
cd ..
```

### 4. Start Local Development
Start the Worker API in Terminal 1:
```bash
npm run dev --prefix worker
```

Start the Vite Frontend in Terminal 2:
```bash
npm run dev
```

Visit `http://localhost:5173` to explore the frontend, or `http://localhost:8787/api/v1/content/services` to test the API.

### 5. Run Quality Gates
```bash
npm run lint
npm run typecheck
npm run test:all
npm run build
```

---
## 🏗️ Architecture Overview

```
                          ┌──────────────────────────┐
                          │     Client Browser       │
                          └─────────────┬────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 │                                             │
                 ▼                                             ▼
  ┌─────────────────────────────┐               ┌─────────────────────────────┐
  │      Cloudflare Pages       │               │     Cloudflare Workers      │
  │    (React 19 + Vite SPA)    │               │   (Hono.js Edge REST API)   │
  │                             │               │                             │
  │  • TanStack React Query 5   │               │  • Web Crypto JWT (Admin)   │
  │  • Tailwind CSS 3 UI        │               │  • Cookie Sessions (Cust.)  │
  │  • Visual Admin CMS Portal  │               │  • CSRF Double-Submit       │
  │  • Customer Account UI      │               │  • KV Sliding Rate Limiter  │
  │  • NOWPayments Checkout     │               │  • Zod Input Validation     │
  │  • AI Chat Widget           │               │  • Auto-Purge Cache Logic   │
  └─────────────────────────────┘               └──────────────┬──────────────┘
                                                               │
                                         ┌─────────────────────┴─────────────────────┐
                                         ▼                                           ▼
                          ┌─────────────────────────────┐             ┌─────────────────────────────┐
                          │   Cloudflare KV Cache       │             │    Cloudflare D1 Database   │
                          │        (CONTENT_KV)         │             │    (Serverless SQLite /     │
                          │   Sub-millisecond reads     │             │     Drizzle ORM Tables)     │
                          └─────────────────────────────┘             └─────────────────────────────┘
```

---

## ✨ Key Features

- **⚡ Global Edge Performance:** Sub-50ms TTFB worldwide via Cloudflare Workers (V8 Isolates) and Cloudflare Pages.
- **🛡️ 3-Tier Multi-Cache Strategy:** Edge Cache-Control headers → Cloudflare KV → Cloudflare D1 with automatic cache purging on admin mutations.
- **🎛️ Integrated Visual Admin CMS:** Manage Services, Solutions, Pricing, FAQs, Site Branding (international phone, social links, header/footer logos), Legal pages, and contact leads live at `/admin`.
- **👤 Full Customer Auth System:** Email/password registration and login, PKCE OAuth (Google, X/Twitter), email verification, password reset, session management with CSRF protection, and a full self-service account dashboard.
- **🔐 Dual Authentication Architecture:** Admin users use stateless HS256 JWT Bearer tokens; customers use httpOnly session cookies with domain-scoped CSRF double-submit tokens.
- **💳 NOWPayments Crypto Checkout:** Production-grade non-custodial cryptocurrency checkout with HMAC-SHA512 IPN webhook verification, idempotent state machine, and opaque status-token access control.
- **📬 Dynamic Lead Capture:** Inbound contact submissions stored in D1 with IP rate limiting and inline validation feedback.
- **🌍 International Contact Phone:** Validated/normalized with `libphonenumber-js` and stored as E.164.
- **🖼️ Header/Footer Logo Management:** Optional Cloudflare R2-backed logo uploads (PNG/JPEG/WebP, magic-byte validated) with text-brand fallback.
- **⚖️ Editable Legal Pages:** CMS-managed Privacy Policy / Terms of Service — unpublished by default, never invented in code.
- **⚡ Instant UX (Zero-Flicker):** React Query `placeholderData` pattern for immediate renders from bundled fallbacks while background-syncing.
- **🤖 Narrow AI Chat Assistant:** Owned chat widget answering only Dreamwebapp sales/service questions, with grounded knowledge and honest human-handoff.
- **🤖 Automated GitHub Actions CI/CD:** Continuous deployment on every push to `main` for both Cloudflare Pages and Workers.

---

## 📁 Project Directory Structure

```
dreamwebapp/
├── .github/
│   └── workflows/
│       ├── ci.yml                       # Continuous Integration: Lint, Typecheck, Test, Build
│
├── src/                                # Frontend React Application
│   ├── components/
│   │   ├── admin/                      # AccountSecurityPanel, AdminShell, CustomersPanel, PaymentsPanel, CountryPhoneInput
│   │   ├── chat/                       # Owned AI chat widget (ChatProvider, ChatPanel, ChatLauncher, ChatMessageList, ChatHandoffForm)
│   │   ├── common/                     # Button, Card, FormField, Section, SocialIcon
│   │   ├── contact/                    # ContactForm (name/email/business type/website/optional phone/message)
│   │   ├── home/                       # FAQItem accordion, Hero components
│   │   ├── payment/                    # PaymentStatusBadge
│   │   ├── pricing/                    # PricingCard components
│   │   ├── services/                   # ServiceCard components
│   │   └── solutions/                  # SolutionSection components
│   ├── config/
│   │   ├── appConfig.ts                # Application metadata
│   │   └── env.ts                      # Type-safe environment loader with production fallbacks
│   ├── content/
│   │   ├── chat.ts                     # Chat prompt & canned replies
│   │   └── fallback/                   # Bundled fallback content (offline/initial render: site, services, solutions, pricing, faq)
│   ├── hooks/
│   │   ├── useAuth.tsx                 # Stateful Admin Auth context & hook (JWT Bearer)
│   │   ├── useChat.ts                  # AI chat conversation state & mutation
│   │   ├── useContact.ts               # Contact mutation hook
│   │   ├── useContent.ts               # React Query hooks with QUERY_KEYS constants
│   │   ├── useCustomerAuth.tsx         # Customer session context & hook (cookie-based)
│   │   ├── useFocusTrap.ts             # Accessibility focus trap for modals
│   │   ├── usePayment.ts               # Payment checkout & order status hooks
│   │   └── useScrollToTop.ts           # Scroll-to-top on route change
│   ├── layouts/
│   │   ├── Footer.tsx                  # Public dynamic footer (logo, social links, phone, legal links)
│   │   ├── Header.tsx                  # Public dynamic header (dynamic logo)
│   │   └── MainLayout.tsx              # Root public layout wrapper
│   ├── lib/
│   │   ├── api-client.ts               # Typed fetch wrapper, Admin CMS methods, Customer API methods
│   │   ├── payment-plans.ts            # Client-side plan key constants (synced with server catalog)
│   │   ├── phone.ts                    # libphonenumber-js helpers (country list, E.164 parse/format)
│   │   ├── query-client.ts             # TanStack QueryClient with 5m staleTime
│   │   ├── social.ts                   # Canonical social-platform list/labels/icons
│   │   └── validation.ts               # Form validation helpers
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── AdminDashboardPage.tsx        # Full Visual CMS Dashboard (Services, Pricing, FAQs, Branding, Legal, Leads, Customers, Payments)
│   │   │   ├── AdminForgotPasswordPage.tsx   # Request an admin password-reset email
│   │   │   ├── AdminLoginPage.tsx            # Admin authentication (HS256 JWT)
│   │   │   ├── AdminResetPasswordPage.tsx    # Consume reset token & set new admin password
│   │   │   └── AdminVerifyEmailChangePage.tsx# Admin email change verification flow
│   │   ├── customer/
│   │   │   ├── AccountDashboardPage.tsx      # Customer self-service (profile, services, payments, security, deletion)
│   │   │   ├── ForgotPasswordPage.tsx        # Customer forgot-password flow
│   │   │   ├── LoginPage.tsx                 # Customer login (email/password + OAuth)
│   │   │   ├── RegisterPage.tsx              # Customer registration (email/password + OAuth)
│   │   │   ├── ResetPasswordPage.tsx         # Customer password reset (token from email)
│   │   │   └── VerifyEmailPage.tsx           # Customer email verification (token from email)
│   │   ├── AboutPage.tsx
│   │   ├── ContactPage.tsx
│   │   ├── CryptoCheckoutPage.tsx      # Step-by-step first-party crypto checkout page
│   │   ├── HomePage.tsx
│   │   ├── LegalPage.tsx               # Shared renderer for CMS-managed legal pages (plain text only)
│   │   ├── PaymentReturnPage.tsx       # Post-checkout return page (polls order status)
│   │   ├── PricingPage.tsx
│   │   ├── PrivacyPolicyPage.tsx       # Wraps LegalPage with id="privacy-policy"
│   │   ├── ServicesPage.tsx
│   │   ├── SolutionsPage.tsx
│   │   └── TermsOfServicePage.tsx      # Wraps LegalPage with id="terms-of-service"
│   ├── router/
│   │   └── index.tsx                   # React Router route definitions (public + admin + customer routes)
│   ├── styles/
│   │   └── index.css                   # Tailwind directives & CSS custom properties
│   └── main.tsx                        # React DOM entrypoint with Providers
│
├── worker/                             # Cloudflare Workers Backend API
│   ├── migrations/                     # Additive-only SQL migrations
│   │   ├── 0001_initial.sql            # Core tables (admin, services, solutions, pricing, faq, site, contacts, legal)
│   │   ├── 0002_admin_security_and_cms.sql    # Admin security hardening + CMS improvements
│   │   ├── 0003_contact_phone.sql      # Optional E.164 phone on contacts
│   │   ├── 0004_admin_account_email_change.sql# Admin email-change verification flow
│   │   ├── 0005_payment_orders.sql     # payment_orders + payment_events tables (NOWPayments)
│   │   └── 0006_customer_accounts_and_services.sql  # customer_sessions, customer_tokens, customer_services
│   ├── scripts/                        # Local-only CLI tools (not deployed)
│   │   ├── generate-password-hash.mjs  # PBKDF2 hash generator for admin bootstrap
│   │   ├── seed-legal-drafts.mjs       # Generates Privacy Policy / Terms SQL draft
│   │   └── verify-schema.mjs           # Schema verification script
│   ├── src/
│   │   ├── db/
│   │   │   ├── index.ts                # Drizzle ORM client factory
│   │   │   └── schema.ts               # All 18 D1 database tables & relations
│   │   ├── lib/
│   │   │   ├── admin-customer-service.ts  # Admin-facing customer management (list, disable)
│   │   │   ├── ai-provider.ts          # Cloudflare Workers AI wrapper with typed fallback
│   │   │   ├── customer-auth-service.ts   # Customer auth core (register, login, session, OAuth PKCE, canonical redirects)
│   │   │   ├── email-provider.ts       # Resend email (admin reset + customer verification)
│   │   │   ├── knowledge.ts            # AI chat knowledge builder from public content
│   │   │   ├── media-assets.ts         # R2 logo upload/delete/stream helpers
│   │   │   ├── payments/               # NOWPayments integration
│   │   │   │   ├── catalog.ts          # Server-authoritative plan pricing catalog
│   │   │   │   ├── money.ts            # Decimal string arithmetic & minimum-amount validation
│   │   │   │   ├── nowpayments-client.ts  # NOWPayments REST API client
│   │   │   │   ├── repository.ts       # D1 order/event CRUD + idempotency helpers
│   │   │   │   ├── types.ts            # Payment status types & state machine rules
│   │   │   │   └── webhook.ts          # HMAC-SHA512 IPN signature verification
│   │   │   ├── prompt.ts               # AI system prompt builder
│   │   │   ├── reset-token.ts          # Single-use hashed reset/verification token helpers
│   │   │   └── social-links.ts         # Canonical social-platform list (backend mirror of frontend)
│   │   ├── middleware/
│   │   │   ├── auth.ts                 # Admin: Web Crypto JWT (HS256) + PBKDF2-SHA256 password hashing
│   │   │   ├── cache.ts                # KV cache read/write/invalidation helpers & headers
│   │   │   ├── customer-auth.ts        # Customer: httpOnly session cookies + domain-scoped CSRF double-submit
│   │   │   └── ratelimit.ts            # Sliding-window KV rate limiter
│   │   ├── routes/
│   │   │   ├── __tests__/
│   │   │   │   ├── helpers/d1-mock.ts  # Shared in-memory D1 mock (used by all test files)
│   │   │   │   ├── assets.test.ts
│   │   │   │   ├── cookie-csrf-cors.test.ts  # CSRF, cookie-domain, CORS tests
│   │   │   │   ├── customer-auth.test.ts     # Customer auth & account subsystem (24 tests)
│   │   │   │   └── payments.test.ts    # Payment routes & webhook tests
│   │   │   ├── account.ts              # /api/v1/account/* (services, payments, deletion — auth required)
│   │   │   ├── admin.ts                # /api/v1/admin/* (CMS CRUD + customer management — JWT required)
│   │   │   ├── chat.ts                 # /api/v1/chat (narrow AI chatbot)
│   │   │   ├── contact.ts              # /api/v1/contact (lead capture)
│   │   │   ├── content.ts              # /api/v1/content/* (public cached content)
│   │   │   ├── customer-auth.ts        # /api/v1/auth/* (register, login, logout, OAuth, password reset)
│   │   │   ├── payments.ts             # /api/v1/payments/* (currencies, checkout, order status)
│   │   │   └── webhooks.ts             # /api/v1/webhooks/nowpayments (IPN handler — HMAC verified)
│   │   ├── types/
│   │   │   └── env.ts                  # Cloudflare bindings + all secret/var declarations
│   │   ├── validators/
│   │   │   └── schemas.ts              # Zod input validation schemas (all routes)
│   │   └── index.ts                    # Hono app entrypoint — CORS, security headers, route mounting
│   ├── drizzle.config.ts               # Drizzle Kit configuration
│   ├── package.json                    # Worker dependencies (Hono, Drizzle, Zod, libphonenumber-js, Wrangler, Vitest)
│   ├── tsconfig.json                   # Worker TypeScript config
│   ├── vitest.config.ts                # Worker Vitest test configuration
│   ├── worker-configuration.d.ts       # Generated Cloudflare environment types
│   └── wrangler.jsonc                  # Cloudflare Workers deployment config (keep_vars, bindings, vars, observability)
│
├── public/                             # Static assets & _redirects for SPA routing
├── .env.example                        # Template for frontend environment variables
├── package.json                        # Frontend dependencies & scripts
├── tailwind.config.cjs                 # Tailwind styling configuration
└── vite.config.ts                      # Vite build configuration
```

---

## 🛠️ Local Development Setup

### Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher

---

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/your-org/dreamwebapp-community.git
cd dreamwebapp

# Install Frontend dependencies
npm install

# Install Backend Worker dependencies
cd worker
npm install
cd ..
```

---

### 2. Environment Variables

Create your local `.env` file from the template:

```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
VITE_API_BASE_URL=http://localhost:8787
VITE_CONTACT_ENDPOINT=/api/v1/contact
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_CHAT_WIDGET=true
# Optional analytics (only if VITE_ENABLE_ANALYTICS=true):
# VITE_GA_ID=G-XXXXXXXXXX
# VITE_GTM_ID=GTM-XXXXXXX
```

> Full variable reference (including production URLs and what must **never** go in `.env`): [Configuration & Credentials Reference](#-configuration--credentials-reference-private-repo).

> **Note:** `.env` and `.env.*` files (except `.env.example`) are gitignored to ensure security.

---

### 3. Running Backend API Locally (Cloudflare Worker)

In **Terminal 1**:

```bash
cd worker

# 0. Local Worker secrets (required for admin login/JWT)
cp .dev.vars.example .dev.vars
# Edit .dev.vars — set JWT_SECRET to any long random string for local dev only

# 1. Apply D1 migrations to local SQLite (first time only)
npx wrangler d1 migrations apply dreamwebapp-db --local

# 2. Start the local Worker dev server
npx wrangler dev --local
```

The Worker starts on **`http://127.0.0.1:8787`** simulating Cloudflare D1 and KV on-disk.

> **Wrangler login:** run `npx wrangler login` once if Workers AI or remote bindings fail locally. See [Configuration & Credentials Reference](#-configuration--credentials-reference-private-repo) for every secret name, URL, and Cloudflare ID.

---

### 4. Running Frontend Locally (Vite)

In **Terminal 2**:

```bash
# From project root:
npm run dev
```

The frontend will start on **`http://localhost:5173`**.

---

## 🔑 Configuration & Credentials Reference (Private Repo)

This project is **private**, so this section lists every URL, binding ID, env var name, and secret name you need for local dev and production. **Never commit actual secret values** (tokens, API keys, JWT secrets, admin passwords) — store them in Cloudflare Worker secrets, GitHub Actions secrets, or local gitignored files only.

### Live URLs

| Purpose | URL |
|---|---|
| Public marketing site (custom domain) | `https://dreamwebapp.com`, `https://www.dreamwebapp.com` |
| Production Worker API (canonical backend) | `https://api.yourdomain.com` |
| Cloudflare Pages project | `dreamwebapp` (deploy target; custom domains above) |
| Local frontend (Vite) | `http://localhost:5173` |
| Local Worker API (`wrangler dev --local`) | `http://127.0.0.1:8787` |
| Admin login (production) | `https://dreamwebapp.com/admin/login` |
| Admin login (local) | `http://localhost:5173/admin/login` |
| Resend REST API (password reset emails only) | `https://api.resend.com/emails` |

> The frontend talks to the Worker via `VITE_API_BASE_URL` (local: `http://localhost:8787`, production: `https://api.yourdomain.com`). Production builds strictly validate this HTTPS origin.

### Cloudflare account & resource IDs

All IDs below are committed in `worker/wrangler.jsonc` — treat them as the source of truth if this table and the file ever diverge.

| Resource | Name / binding | ID / value |
|---|---|---|
| Cloudflare Account | — | `your-cloudflare-account-id` |
| Worker (Wrangler `name`) | `dreamwebapp-api` | — |
| Worker (deployed production name) | `dreamwebapp-api-production` | Created by `wrangler deploy --env production` |
| D1 database | `dreamwebapp-db` → binding `DB` | `00000000-0000-0000-0000-000000000000` |
| KV namespace | `CONTENT_KV` | `00000000000000000000000000000000` |
| KV preview namespace (local/preview) | `CONTENT_KV` preview | `00000000000000000000000000000001` |
| R2 bucket | `your-r2-bucket-name` → binding `LOGO_ASSETS` | Enabled on account; bucket name in `wrangler.jsonc` |
| Workers AI | binding `AI` | No ID — account-scoped; no API key |

### Frontend Environment Variables (`.env` at repo root)

All `VITE_*` — embedded in the client bundle at build time. **Never put Worker secrets here.**

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | Yes (local) | Worker API base URL. Local: `http://localhost:8787`. Prod: `https://api.yourdomain.com` |
| `VITE_CONTACT_ENDPOINT` | No | Contact form POST path (default `/api/v1/contact`) |
| `VITE_ENABLE_ANALYTICS` | No | Feature flag for analytics hooks (default `false`) |
| `VITE_ENABLE_CHAT_WIDGET` | No | Set `false` to hide the AI chat widget (default `true`) |
| `VITE_GA_ID` | No | Optional Google Analytics ID |
| `VITE_GTM_ID` | No | Optional Google Tag Manager ID |

### Worker Vars (Non-Secret — in `worker/wrangler.jsonc`)

| Variable | Local / default | Production (`env.production`) |
|---|---|---|
| `CORS_ORIGIN` | `https://dreamwebapp.com,https://www.dreamwebapp.com,http://localhost:5173` | `https://dreamwebapp.com,https://www.dreamwebapp.com` |
| `PUBLIC_APP_ORIGIN` | `http://localhost:5173` | `https://dreamwebapp.com` |
| `COOKIE_DOMAIN` | *(unset)* | `dreamwebapp.com` |
| `ENVIRONMENT` | `development` | `production` |

> **`COOKIE_DOMAIN`** is required in production for domain-scoped CSRF cookies. The Worker validates that every HTTPS origin in `CORS_ORIGIN` is a subdomain of this value and fails closed if unset.

### Worker Secrets (Cloudflare — **never in git**)

Set with `npx wrangler secret put <NAME> --env production`. For **local dev**, copy `worker/.dev.vars.example` → `worker/.dev.vars` (gitignored).

#### Core Secrets

| Secret | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | **Yes** | Admin JWT sign/verify (HS256). Required for `/admin` login. |
| `RESEND_API_KEY` | Optional | Resend API key for transactional email (admin reset + customer verification). Without it, email endpoints return `503`. |
| `RESEND_FROM_EMAIL` | Optional | Verified Resend sender address. Must pair with `RESEND_API_KEY`. |

#### Customer OAuth Secrets (Optional)

| Secret | Purpose |
|---|---|
| `CUSTOMER_AUTH_GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID |
| `CUSTOMER_AUTH_GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret |
| `CUSTOMER_AUTH_X_CLIENT_ID` | X (Twitter) OAuth 2.0 Client ID |
| `CUSTOMER_AUTH_X_CLIENT_SECRET` | X (Twitter) OAuth 2.0 Client Secret |

#### NOWPayments Secrets (Optional)

| Secret | Purpose |
|---|---|
| `NOWPAYMENTS_API_KEY` | NOWPayments REST API key |
| `NOWPAYMENTS_IPN_SECRET` | IPN webhook HMAC-SHA512 verification secret |

> **Not secrets:** `AI`, `DB`, `CONTENT_KV`, and `LOGO_ASSETS` are Wrangler **bindings** — no keys to configure.

### GitHub Actions (CI/CD)

Repository: `https://github.com/your-org/dreamwebapp-community`

| Name | Type | Value / notes |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | Cloudflare API token — needs **Workers Scripts Edit**, **Pages Edit**, **D1 Edit**, **Workers KV Storage Edit**, and **R2** (for logo uploads). Stored only in GitHub; not in repo. |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | `your-cloudflare-account-id` |
| `VITE_API_BASE_URL` | Variable (optional) | `https://api.yourdomain.com` — CI defaults to this (see `.github/workflows/deploy-pages.yml`) |

Worker deploy workflow does **not** pass `JWT_SECRET` or Resend keys — those live on Cloudflare only. Pages build bakes `VITE_*` vars at compile time.

### Admin access (no repo-shipped password)

| Item | Status |
|---|---|
| Default admin email/password | **None** — never shipped in this repo |
| Bootstrap | `node worker/scripts/generate-password-hash.mjs` → insert into D1 `admin_users` (see [Creating or Resetting Admin Users](worker/README.md#-creating-or-resetting-admin-users)) |
| Password rotation (preferred) | `/admin/forgot-password` once `RESEND_*` secrets are set |
| JWT session | Stateless HS256, 8-hour expiry; reset does not revoke already-issued tokens (see worker README) |

### External accounts/services

| Service | Required? | What you need |
|---|---|---|
| [Cloudflare](https://dash.cloudflare.com) | **Yes** | Account ID above; API token for CI; R2 enabled on account; Workers AI (default on account) |
| [Resend](https://resend.com) | Optional | API key + verified sending domain for admin password-reset email only |
| GitHub | **Yes** (for CI) | Repo access + Actions secrets above |

---

## 🎛️ Visual Admin CMS Portal

A built-in dashboard allows administrators to update all website content live without redeploying code.

- **Admin Login:** [`https://dreamwebapp.com/admin/login`](https://dreamwebapp.com/admin/login) *(or `http://localhost:5173/admin/login` locally)*
- **Admin Dashboard:** [`https://dreamwebapp.com/admin`](https://dreamwebapp.com/admin)

There is no default admin account or password shipped with this repository. See [Creating or Resetting Admin Users](worker/README.md#-creating-or-resetting-admin-users) in the Worker README for the safe, operator-controlled way to create the first admin account and to rotate a password afterwards (via the "Forgot password?" flow on the login page).

### Dashboard Modules
1. **Services:** Create, edit, reorder, or delete AI chatbot & automation services.
2. **Solutions:** Edit industry-specific problem/solution cards.
3. **Pricing Plans & Add-ons:** Adjust monthly prices, setup fees, badges, and features.
4. **FAQs:** Add, update, categorize, and reorder Q&As.
5. **Site Settings:** Brand name, tagline, description, navigation, footer copyright, contact phone (E.164), social links, and header/footer logo uploads.
6. **Legal:** Edit and publish Privacy Policy / Terms of Service pages. Both seeded as unpublished admin-editable drafts — never shown to visitors until explicitly published from Admin → Legal.
7. **Leads & Inquiries:** Inspect incoming contact requests and manage statuses (`unread`, `read`, `archived`).
8. **Customer Management:** View registered customers, disable accounts, and review activity (Admin-only — requires JWT).

---

## 👤 Customer Authentication & Account System

The platform includes a full self-service customer identity system, completely separate from admin authentication.

### Authentication Methods

- **Email/Password:** PBKDF2-SHA256 hashing with random 16-byte salt and 100,000 iterations.
- **OAuth (PKCE):** Google and X (Twitter) sign-in. PKCE verifier and state are stored in KV with a 10-minute TTL during the authorization handshake, preventing CSRF state forgery.
- **OAuth Callback & Canonical Redirect:** The OAuth callback URL (`https://api.yourdomain.com/api/v1/auth/oauth/:provider/callback`) exchanges the authorization code, sets domain-scoped session and CSRF cookies, and issues an absolute `302` redirect directly to the canonical frontend origin (`https://dreamwebapp.com/account` or sanitized `returnTo`).

### Session & Security Model

- **Session Cookies:** `httpOnly`, `SameSite=Lax`, `Secure` (production), stored as SHA-256 hash in D1 `customer_sessions`.
- **CSRF Protection:** Double-submit cookie pattern. The Worker sets a JavaScript-readable `dreamwebapp_csrf` cookie (`Domain=dreamwebapp.com` in production). Every state-changing request (`POST`, `PUT`, `DELETE`, `PATCH`) must include this value as the `X-CSRF-Token` header.
- **Cookie Domain Migration:** On every authenticated response, the Worker re-issues the domain-scoped CSRF cookie and expires any legacy host-only cookie — ensuring transparent migration without re-login.
- **Email Verification:** Registration sends a single-use, time-limited verification link.
- **Password Reset:** Single-use, 30-minute token delivered via Resend.

### Account Dashboard Features

- **Profile:** View/update display name; change email (sends verification link to new address).
- **Services:** View active service entitlements provisioned after successful payment.
- **Payments:** Full payment order history with status labels.
- **Security:** Change password; OAuth provider management.
- **Account Deletion:** Self-service deletion (blocked if active services or paid orders exist).

---

## 🤖 AI Chat Assistant

A narrow, owned chat widget (`src/components/chat/`) that answers only Dreamwebapp sales/service questions.

- **User-initiated:** the launcher never opens automatically.
- **Grounded knowledge only:** the Worker builds context from public content at `/api/v1/content/*` — see `worker/src/lib/knowledge.ts`.
- **Provider:** Cloudflare Workers AI via the `AI` binding — **no API key required**.
- **Deterministic fallback:** if unavailable, returns an honest "temporarily unavailable" message — never fabricates an answer.
- **Human handoff:** "Talk to a person" submits a lead via `POST /api/v1/contact` with `source: 'chatbot'`.
- **Kill-switch:** set `VITE_ENABLE_CHAT_WIDGET=false` to hide the widget entirely.

---

## ⚡ Multi-Tier Caching & Invalidation

```
Client Request
      │
      ▼
1. Cloudflare Edge CDN ───[Hit (s-maxage=60s)]─────────> Return <5ms
      │ Miss
      ▼
2. Cloudflare KV Cache ───[Hit (TTL=3600s)]─────────────> Return <20ms
      │ Miss
      ▼
3. Cloudflare D1 (SQLite) ─[Query DB via Drizzle]───────> Populate KV ──> Return
```

- **Cache-Control Header:** `public, max-age=300, s-maxage=60, stale-while-revalidate=120`
  - Edge CDN revalidates within **60 seconds**.
  - Browser caches for **5 minutes** (matches TanStack Query `staleTime`).
- **Instant Invalidation:** When an update is submitted via `/api/v1/admin/*`, the corresponding KV cache key (`content:site`, `content:services`, `content:pricing`, etc.) is deleted immediately. The next public request repopulates KV from D1.

---

## 📡 API Endpoints Reference

### Public Endpoints (Cached)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | API Health Check |
| `GET` | `/api/v1/content/site` | Site branding, navigation, social links, contact phone |
| `GET` | `/api/v1/content/services` | Active service offerings |
| `GET` | `/api/v1/content/solutions` | Active industry solutions |
| `GET` | `/api/v1/content/pricing` | Pricing plans and add-ons |
| `GET` | `/api/v1/content/faq` | Frequently asked questions |
| `GET` | `/api/v1/content/legal/:id` | Published legal page (`privacy-policy` \| `terms-of-service`); `data: null` while unpublished |
| `GET` | `/api/v1/content/assets/:id` | Public logo asset (streamed from R2); `404` if missing |

### Lead Capture (Rate-Limited)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/contact` | Inbound contact form — name, email, business type, optional phone, message. Also used by chat widget handoff (`source: 'chatbot'`). Max 5/15min per IP. |

### AI Chat (Rate-Limited)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/chat` | Narrow chatbot — grounded Q&A, solution recommendation, human-handoff detection. Max 20/10min per IP. |

### Customer Auth (`/api/v1/auth/*`)
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/auth/capabilities` | No | Provider availability booleans |
| `POST` | `/api/v1/auth/register` | No | Email/password registration + cookie session |
| `POST` | `/api/v1/auth/login` | No | Email/password login + cookie session |
| `POST` | `/api/v1/auth/logout` | Session cookie | Revoke session + clear cookies |
| `GET` | `/api/v1/auth/me` | Session cookie | Current customer profile |
| `PUT` | `/api/v1/auth/me` | Session cookie + CSRF | Update customer profile |
| `GET` | `/api/v1/auth/oauth/:provider/start` | No | Begin PKCE OAuth flow (`google` \| `x`) |
| `GET` | `/api/v1/auth/oauth/:provider/callback` | No | Complete PKCE OAuth flow + set cookie session |
| `POST` | `/api/v1/auth/password-reset/request` | No | Request customer password reset email |
| `POST` | `/api/v1/auth/password-reset/confirm` | No | Consume reset token + set new password |
| `POST` | `/api/v1/auth/email-verification/resend` | Session cookie + CSRF | Re-send verification email |
| `POST` | `/api/v1/auth/email-verification/confirm` | No | Consume email verification token |

### Customer Account (`/api/v1/account/*` — Session Cookie + CSRF Required)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/account/services` | Paginated list of customer's service entitlements |
| `GET` | `/api/v1/account/services/:serviceId` | Single service entitlement details |
| `GET` | `/api/v1/account/payments` | Paginated customer payment order history |
| `GET` | `/api/v1/account/payments/:orderId` | Single payment order details |
| `GET` | `/api/v1/account/deletion-eligibility` | Check if account is eligible for deletion |
| `DELETE` | `/api/v1/account/me` | Self-service account deletion (blocked if active services or paid orders) |

### Payments (`/api/v1/payments/*`)
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/payments/currencies` | No | List supported pay currencies (rate-limited) |
| `POST` | `/api/v1/payments/checkout` | Session cookie + CSRF | Create NOWPayments invoice + D1 order record |
| `GET` | `/api/v1/payments/orders/:orderId` | Status token or session | Poll order status |

### NOWPayments Webhook
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/webhooks/nowpayments` | HMAC-SHA512 IPN signature | Receive and process payment status updates |

### Admin Auth & Password Reset (Public, No JWT)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/admin/auth/login` | Authenticate & obtain admin JWT |
| `POST` | `/api/v1/admin/auth/request-reset` | Request admin password-reset email |
| `POST` | `/api/v1/admin/auth/reset-password` | Consume reset token & set new password |

### Admin CMS (Bearer JWT Required)
| Method | Endpoint | Description |
|---|---|---|
| `GET` / `PUT` | `/api/v1/admin/site` | Site branding, contact phone, navigation, social links, logo refs |
| `GET` | `/api/v1/admin/capabilities` | Provider availability booleans (logo storage, email configured) |
| `GET/POST/PUT/DELETE` | `/api/v1/admin/services` | Full CRUD for services |
| `GET/POST/PUT/DELETE` | `/api/v1/admin/solutions` | Full CRUD for solutions |
| `GET/POST/PUT/DELETE` | `/api/v1/admin/pricing/plans` | Full CRUD for pricing plans |
| `GET/POST/PUT/DELETE` | `/api/v1/admin/pricing/addons` | Full CRUD for pricing add-ons |
| `GET/POST/PUT/DELETE` | `/api/v1/admin/faq` | Full CRUD for FAQs |
| `GET` / `PUT` | `/api/v1/admin/legal/:id` | Legal pages CRUD (title, body, published state) |
| `POST` / `DELETE` | `/api/v1/admin/assets/logo` | Upload/replace or remove header/footer logo (R2) |
| `GET` / `PUT` | `/api/v1/admin/contacts` | View & update contact lead statuses |
| `GET` | `/api/v1/admin/customers` | Paginated list of registered customers |
| `POST` | `/api/v1/admin/customers/:id/disable` | Disable a customer account + revoke sessions |
| `GET` | `/api/v1/admin/payments/summary` | Payment activity summary |
| `GET` | `/api/v1/admin/health/schema` | Verify all required D1 tables exist |

---

## 🗺️ Frontend Routes

| Path | Page | Layout |
|---|---|---|
| `/` | Home | MainLayout |
| `/services` | Services | MainLayout |
| `/solutions` | Solutions | MainLayout |
| `/pricing` | Pricing | MainLayout |
| `/about` | About | MainLayout |
| `/contact` | Contact | MainLayout |
| `/login` | Customer Login | MainLayout |
| `/register` | Customer Registration | MainLayout |
| `/forgot-password` | Customer Forgot Password | MainLayout |
| `/reset-password` | Customer Password Reset | MainLayout |
| `/verify-email` | Customer Email Verification | MainLayout |
| `/account` | Customer Account Dashboard | MainLayout |
| `/privacy-policy` | Privacy Policy (CMS-managed) | MainLayout |
| `/terms-of-service` | Terms of Service (CMS-managed) | MainLayout |
| `/payment/return` | Post-Payment Return | MainLayout |
| `/admin/login` | Admin Login | Standalone |
| `/admin/forgot-password` | Admin Forgot Password | Standalone |
| `/admin/reset-password` | Admin Reset Password | Standalone |
| `/admin/verify-email-change` | Admin Email Change Verification | Standalone |
| `/admin` | Admin CMS Dashboard | Standalone |

---

## 🤖 Automated CI/CD Workflows (GitHub Actions)

The repository includes two GitHub Actions workflows in `.github/workflows/`:

1. **`deploy-pages.yml`**: Automatically builds and deploys the frontend to Cloudflare Pages on push to `main` (ignoring `worker/**`).
2. **`deploy-worker.yml`**: Automatically deploys the Worker backend API to Cloudflare Workers on push to `main` (triggering on `worker/**`).

### Required GitHub Repository Secrets & Variables

> Full inventory (URLs, Cloudflare IDs, Worker secrets, frontend vars): [Configuration & Credentials Reference](#-configuration--credentials-reference-private-repo).

Set these under **GitHub Repo Settings ➔ Secrets and variables ➔ Actions**:

#### Repository Secrets:
| Secret Name | Description | Example / Current Value |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token with **Workers Scripts Edit**, **Pages Edit**, **D1 Edit**, **Workers KV Storage Edit**, and **R2** permissions | Stored in GitHub only — never commit |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | `your-cloudflare-account-id` |

#### Repository Variables:
| Variable Name | Description | Value |
|---|---|---|
| `VITE_API_BASE_URL` | Production Worker API base URL (baked into Pages build) | `https://api.yourdomain.com` |

---

## 🚀 Complete Production Deployment Guide

### Production Resource Bindings Summary
- **Account ID:** `your-cloudflare-account-id`
- **D1 Database:** `dreamwebapp-db` (`00000000-0000-0000-0000-000000000000`)
- **KV Namespace:** `CONTENT_KV` (`00000000000000000000000000000000`, preview `00000000000000000000000000000001`)
- **R2 Bucket:** `your-r2-bucket-name` (binding `LOGO_ASSETS`) — logo uploads only; binary image data never touches D1/KV
- **Workers AI:** `AI` binding — no secret required; powers `/api/v1/chat`
- **Worker deploy name:** `dreamwebapp-api-production` (`wrangler deploy --env production`)
- **Pages project name:** `dreamwebapp`
- **Optional Worker secrets:** `JWT_SECRET` (required on Cloudflare, not in git), `RESEND_API_KEY` / `RESEND_FROM_EMAIL` (password reset — **unset in production today**)
- **Production Worker URL:** `https://api.yourdomain.com`
- **Custom Domains:** `dreamwebapp.com`, `www.dreamwebapp.com`

---

### Part 1: Deploy Backend Worker (D1 + KV + Secrets)

#### Step 1: Configure `worker/wrangler.jsonc`
Bindings are explicitly declared in both root and `env.production` blocks (Wrangler requirement):
```jsonc
{
  "name": "dreamwebapp-api",
  "main": "src/index.ts",
  "account_id": "your-cloudflare-account-id",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "dreamwebapp-db",
      "database_id": "00000000-0000-0000-0000-000000000000",
      "migrations_dir": "migrations"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CONTENT_KV",
      "id": "00000000000000000000000000000000"
    }
  ],
  "r2_buckets": [
    {
      "binding": "LOGO_ASSETS",
      "bucket_name": "your-r2-bucket-name"
    }
  ],
  "ai": {
    "binding": "AI"
  },
  "env": {
    "production": {
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "dreamwebapp-db",
          "database_id": "00000000-0000-0000-0000-000000000000",
          "migrations_dir": "migrations"
        }
      ],
      "kv_namespaces": [
        {
          "binding": "CONTENT_KV",
          "id": "00000000000000000000000000000000"
        }
      ],
      "r2_buckets": [
        {
          "binding": "LOGO_ASSETS",
          "bucket_name": "your-r2-bucket-name"
        }
      ],
      "ai": {
        "binding": "AI"
      },
      "vars": {
        "CORS_ORIGIN": "https://dreamwebapp.com,https://www.dreamwebapp.com",
        "ENVIRONMENT": "production"
      }
    }
  }
}
```

> **Workers AI binding (`ai`):** powers the `/api/v1/chat` assistant. It requires **no API key or secret** — it's authenticated by the Worker's own Cloudflare account (Workers AI is enabled by default, with a free tier). If the binding is ever removed or unavailable, the chat endpoint degrades gracefully to a deterministic "temporarily unavailable" response rather than failing.

> **R2 binding (`r2_buckets` → `LOGO_ASSETS`):** optional — only needed for header/footer logo uploads. R2 must be enabled on the Cloudflare account first (one-time, dashboard-only step; `wrangler r2 bucket create` fails with `error code 10042` until then), after which the bucket and binding above can be created via Wrangler. If this binding is ever absent, upload routes fail closed with a `503` instead of throwing — see `worker/README.md` → "Logo Uploads (R2)".

#### Step 2: Set Worker Secret & Run Remote Migrations
```bash
cd worker

# 1. Upload JWT_SECRET to the production worker
echo "YOUR_STRONG_RANDOM_SECRET" | npx wrangler secret put JWT_SECRET --name dreamwebapp-api-production

# 2. Apply migrations to remote production D1
npx wrangler d1 migrations apply dreamwebapp-db --remote

# 3. Generate a password hash for your own strong, unique password (never commit
#    the output — see worker/README.md "Creating or Resetting Admin Users")
node worker/scripts/generate-password-hash.mjs

# 4. Seed the super admin user using the hash printed above, substituting your
#    own admin email and the hash (do not reuse any hash/password from docs or
#    version control)
npx wrangler d1 execute dreamwebapp-db --remote --command="INSERT OR REPLACE INTO admin_users (id, email, password_hash, role, is_active) VALUES (1, 'YOUR_ADMIN_EMAIL', 'YOUR_GENERATED_HASH', 'super_admin', 1);"

# 5. Deploy worker
npx wrangler deploy --env production

# 6. Optional — enable password-reset email (skip to leave it safely disabled):
#    npx wrangler secret put RESEND_API_KEY
#    npx wrangler secret put RESEND_FROM_EMAIL

# 7. Optional — seed Privacy Policy / Terms of Service admin-editable drafts
#    (still requires manual review + "Published" toggle in Admin → Legal):
node worker/scripts/seed-legal-drafts.mjs worker/scripts/.legal-drafts.sql
npx wrangler d1 execute dreamwebapp-db --remote --file=worker/scripts/.legal-drafts.sql
```

> Steps 6–7 are optional and independent of each other and of step 5 — see `worker/README.md` for full context on password reset (Resend) and logo uploads (R2), including exactly what happens when either is left unconfigured.

---

### Part 2: Deploy Frontend on Cloudflare Pages

1. **Via GitHub Actions (Recommended):**
   * Push code to `main` branch. GitHub Actions automatically builds and publishes `dist/` to Cloudflare Pages.

2. **Via Manual CLI:**
   ```bash
   npm run build
   npx wrangler pages deploy dist --project-name dreamwebapp --branch main
   ```

---

### Part 3: Custom Domains, SSL & Canonical Redirects

1. **Cloudflare Pages (`dreamwebapp.com`):**
   * Configured in **Cloudflare Dashboard ➔ Workers & Pages ➔ dreamwebapp ➔ Custom domains**.
   * Both `dreamwebapp.com` and `www.dreamwebapp.com` are attached to the Pages project.
2. **Canonical Host Redirect Rule (`www` ➔ apex):**
   * Configured in **Cloudflare Dashboard ➔ Rules ➔ Redirect Rules**.
   * **Rule Name:** `Canonicalize www to apex`
   * **Expression:** `http.host eq "www.dreamwebapp.com"`
   * **Action:** Dynamic Redirect (`308 Permanent Redirect`)
   * **Target:** `concat("https://dreamwebapp.com", http.request.uri.path, if(len(http.request.uri.query) > 0, concat("?", http.request.uri.query), ""))`
   * Preserves full request path, query string, and HTTP method while strictly isolating the API hostname (`api.yourdomain.com`).

---

### Post-Deployment Verification Checklist

- [ ] Canonical Redirect Check: `curl -I https://www.dreamwebapp.com/` returns HTTP `308` with `Location: https://dreamwebapp.com/`
- [ ] Path & Query Preservation: `curl -I "https://www.dreamwebapp.com/customer/login?returnTo=%2Faccount&source=www"` returns HTTP `308` with `Location: https://dreamwebapp.com/customer/login?returnTo=%2Faccount&source=www`
- [ ] API Health Check: `curl https://api.yourdomain.com/health` returns `{"status":"ok"}`
- [ ] Public Content Check: `curl https://api.yourdomain.com/api/v1/content/site`
- [ ] Live Site: `https://dreamwebapp.com` renders with 0 console errors
- [ ] Customer Auth: Registration, login, Google OAuth, and password reset succeed and land on `https://dreamwebapp.com/account`
- [ ] Admin Login: `https://dreamwebapp.com/admin/login` authenticates successfully and never displays any credential text
- [ ] Admin Dashboard: Edits to Site Settings / Services / Pricing invalidate cache and update live pages within 60s
- [ ] Lead Submissions: Test message from Contact form (with and without the optional phone number) stores in D1 and appears in Admin Leads tab
- [ ] Password Reset: `/admin/forgot-password` returns a generic message for both known/unknown emails; if Resend is configured, the email actually arrives and the link works once; if not configured, the response is a safe "not available" `503` — never a fake success
- [ ] Legal Pages: `/privacy-policy` and `/terms-of-service` show the neutral "not published yet" message until an administrator publishes them from Admin → Legal; footer links point to the correct routes
- [ ] Logo Upload (only if R2 is bound): Admin → Site Settings → Branding upload/replace/remove works for both Header and Footer, and Header/Footer fall back to the default brand mark if a logo is removed or R2 is unconfigured
- [ ] AI Chat: Open the widget on the live site, ask a pricing/service question, and confirm a grounded answer (or the honest "temporarily unavailable" fallback if Workers AI isn't reachable) — never a fabricated answer
- [ ] Human Handoff: "Talk to a person" inside the chat widget submits successfully and appears in Admin Leads tab

---

## ⚠️ Critical Architecture Rules & Gotchas

1. **Wrangler Environment Inheritance:**
   Wrangler does **NOT** inherit top-level `d1_databases`, `kv_namespaces`, or `r2_buckets` into named `env.<name>` blocks. Always duplicate every binding inside `env.production` — a binding added only at the top level will work locally but silently be `undefined` when deployed with `--env production`.

2. **`COOKIE_DOMAIN` is Required in Production:**
   The customer auth middleware reads `COOKIE_DOMAIN` to set domain-scoped CSRF cookies. If absent in production, CSRF cookies will be scoped to `api.yourdomain.com` only — the frontend JavaScript on `dreamwebapp.com` **cannot read them**, causing `403 CSRF_VALIDATION_FAILED` on every state-changing authenticated request. Always set `COOKIE_DOMAIN=dreamwebapp.com` in `env.production.vars`.

3. **Two Separate Auth Systems — Never Mix:**
   - **Admin:** Stateless HS256 JWT via `Authorization: Bearer <token>` header. Use `jwtMiddleware` from `worker/src/middleware/auth.ts`.
   - **Customer:** httpOnly `dreamwebapp_session` session cookie + JavaScript-readable `dreamwebapp_csrf` double-submit cookie. Use `customerAuthMiddleware` from `worker/src/middleware/customer-auth.ts`.
   Admin JWTs are rejected on customer routes and vice versa.

4. **CSRF Header is `X-CSRF-Token`:**
   Every state-changing customer request (`POST`, `PUT`, `DELETE`, `PATCH`) must include `X-CSRF-Token: <value>` where `<value>` is read from `document.cookie` matching `dreamwebapp_csrf`. Missing or mismatched tokens return `403 CSRF_VALIDATION_FAILED`.

5. **CORS Multi-Origin Matching:**
   `CORS_ORIGIN` is a comma-separated string. `worker/src/index.ts` splits it into an array. Origin matching is **exact** — no wildcards. An untrusted origin receives no `Access-Control-Allow-Origin` header and no credentials.

6. **React Query Key Canonical Naming:**
   Queries are indexed under `QUERY_KEYS` in `src/hooks/useContent.ts`. Always import and use `QUERY_KEYS` when calling `queryClient.invalidateQueries()` — never use short arbitrary keys like `['site']`.

7. **Environment Fallbacks in Frontend:**
   `src/config/env.ts` checks `import.meta.env.PROD` to default `apiBaseUrl` to `https://api.yourdomain.com` in production builds. This prevents CI bundles from ever pointing to `localhost:8787`.

8. **`ApiError` is a Plain Object — Never Use `instanceof Error`:**
   `src/lib/api-client.ts` defines `ApiError` as a plain object literal via `createApiError()`, not a class. Always write `isApiError(err) ? err.message : 'fallback'` in catch blocks. `err instanceof Error` will always evaluate to `false` for these errors, silently discarding the server's specific error message.

9. **NOWPayments Pricing is Server-Authoritative:**
   Plan keys and prices are defined in `worker/src/lib/payments/catalog.ts`. The client sends only a plan key — the Worker resolves the price server-side. Never accept price values from the client. Checkout also requires an authenticated customer session.

10. **Migrations Are Additive Only:**
    Never modify existing migration files. Always create a new numbered migration file. All 6 migrations must be applied in order on any new environment: `0001` → `0002` → `0003` → `0004` → `0005` → `0006`.

11. **Workers AI Needs No Secret:**
    The `AI` binding is authenticated by the Cloudflare account itself. If unavailable, `worker/src/lib/ai-provider.ts` returns a typed failure and the chat route falls back to a safe, honest message.

12. **Legal Page Bodies Are Plain Text by Design:**
    `legal_pages.body` is rendered by splitting on blank lines into `<p>` tags — no Markdown/HTML renderer and no `dangerouslySetInnerHTML`. If rich text is ever added, real sanitization must be added first.

13. **`keep_vars: true` Preserves Dashboard Variables:**
    `worker/wrangler.jsonc` specifies `"keep_vars": true` at the top level. This ensures environment variables set directly in the Cloudflare Dashboard (such as `CUSTOMER_AUTH_GOOGLE_REDIRECT_URI`) are preserved and not wiped out on CLI or CI deployments.

14. **OAuth Callbacks Must Redirect to Canonical Frontend Origin:**
    The backend Worker runs on `api.yourdomain.com`. All OAuth callback handlers (`/api/v1/auth/oauth/:provider/callback`) MUST redirect to absolute canonical frontend URLs (`getCanonicalAppOrigin()`) such as `https://dreamwebapp.com/account` or `https://dreamwebapp.com/login?error=...` rather than relative paths, preventing `404 Route Not Found` errors on the API worker.

---

## 📊 NPM Scripts Reference

### Frontend Scripts (Root Directory)
| Command | Description |
|---|---|
| `npm run dev` | Starts Vite dev server (`http://localhost:5173`) |
| `npm run build` | Runs TypeScript check (`tsc -b`) & builds production bundle to `dist/` |
| `npm run preview` | Previews production build locally (`http://localhost:4173`) |
| `npm run lint` | Runs ESLint across all source files |
| `npm test` | Runs frontend Vitest tests (24 tests) |
| `npm run test:worker` | Runs worker Vitest tests (132 tests) |
| `npm run test:all` | Runs all 156 tests across frontend and worker |
| `npm run typecheck` | Runs TypeScript compiler check without emitting |

### Backend Scripts (`worker/` Directory)
| Command | Description |
|---|---|
| `npx wrangler dev --local` | Starts Worker dev server (`http://127.0.0.1:8787`) |
| `npx wrangler d1 migrations apply dreamwebapp-db --local` | Apply all migrations to local SQLite |
| `npx wrangler d1 migrations apply dreamwebapp-db --remote` | Apply all migrations to production D1 |
| `npx wrangler d1 execute dreamwebapp-db --remote --command "..."` | Run a single SQL statement on production D1 |
| `npx wrangler deploy --env production` | Deploy Worker to Cloudflare production |
| `npx wrangler deploy --dry-run --env production` | Validate bundle & resolved bindings without deploying |
| `npm run typecheck` (in `worker/`) | Regenerate Worker types + `tsc --noEmit` |
| `npm run cf-typegen` (in `worker/`) | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `npx vitest run` (in `worker/`) | Run all 132 Worker unit + integration tests |
| `node worker/scripts/generate-password-hash.mjs` | PBKDF2 hash generator for admin bootstrap |
| `node worker/scripts/seed-legal-drafts.mjs <out.sql>` | Generate Privacy Policy / Terms draft SQL |
| `node worker/scripts/verify-schema.mjs` | Verify D1 schema health and tables |

---

## 💳 NOWPayments Cryptocurrency Checkout Integration

The platform includes a production-grade, non-custodial cryptocurrency checkout integration via NOWPayments with end-to-end webhook verification, rate-limiting, and idempotent entitlement state management.

### Security & Architecture Guarantees
1. **Zero Secret Leakage:** `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET` live exclusively in the Worker environment. No secret is exposed to the browser or `VITE_*` bundles.
2. **Server-Side Pricing:** Authoritative pricing is strictly determined server-side from the product catalog. The client never submits prices, amounts, or callback URLs.
3. **Cryptographic Access Control:** Unauthenticated users receive an opaque status token at checkout. Only its SHA-256 hash is stored in D1, preventing order enumeration attacks.
4. **HMAC-SHA512 Webhook Verification:** The IPN webhook handler validates `x-nowpayments-sig` using timing-safe byte comparison over canonical sorted JSON keys.
5. **Database-Level Idempotency:** Duplicate webhook events are ignored using a database-level `UNIQUE (event_fingerprint)` constraint.
6. **State Machine Protection:** Out-of-order webhook delivery cannot downgrade terminal states (`paid`, `refunded`, `expired`, `failed`).

### Required Worker Secrets & Variables

#### 1. Provision Production Secrets (Cloudflare Worker)
```bash
# In the worker/ directory:
npx wrangler secret put NOWPAYMENTS_API_KEY
# Enter your NOWPayments API Key from: https://nowpayments.io/merchant-settings/api

npx wrangler secret put NOWPAYMENTS_IPN_SECRET
# Enter your IPN Secret from: https://nowpayments.io/merchant-settings/instant-payments-notifications
```

#### 2. Apply Database Migration
```bash
# Local development D1:
npx wrangler d1 migrations apply dreamwebapp-db --local

# Production Cloudflare D1:
npx wrangler d1 migrations apply dreamwebapp-db --remote
```

#### 3. Local Webhook Testing with Cloudflared Tunnel
To receive IPN webhooks on `localhost:8787` during development:

1. Start your local Worker:
   ```bash
   cd worker && npx wrangler dev --local
   ```
2. Start a Cloudflare Tunnel:
   ```bash
   cloudflared tunnel --url http://127.0.0.1:8787
   ```
3. Set the public tunnel callback URL in `worker/.dev.vars`:
   ```ini
   NOWPAYMENTS_API_KEY=your_sandbox_or_live_api_key
   NOWPAYMENTS_IPN_SECRET=your_ipn_secret
   PAYMENT_IPN_CALLBACK_URL=https://<your-tunnel-id>.trycloudflare.com/api/v1/webhooks/nowpayments
   PAYMENT_SUCCESS_URL=http://localhost:5173/payment/return
   PAYMENT_CANCEL_URL=http://localhost:5173/payment/return
   ```

### Webhook URL Endpoint Pattern
- **Production Webhook URL:** `https://<your-worker-domain>/api/v1/webhooks/nowpayments`
- Configure this URL in your NOWPayments Dashboard under **Settings -> Instant Payment Notifications (IPN)**.

---

## 🔧 Tech Stack

- **Frontend:** React 19, Vite 7, TypeScript 5, Tailwind CSS 3, TanStack React Query 5, React Router 7, `libphonenumber-js`.
- **Backend & Edge:** Cloudflare Workers (`nodejs_compat`), Hono.js 4, Drizzle ORM, Cloudflare D1 (SQLite), Cloudflare KV, Cloudflare R2 (optional, logo assets), Cloudflare Workers AI (chat), Zod 3, `libphonenumber-js`.
- **Authentication:** Web Crypto API — HS256 JWT (admin stateless) + PBKDF2-SHA256 httpOnly session cookies (customer) + CSRF double-submit cookie pattern + PKCE OAuth (Google, X/Twitter) + single-use hashed reset/verification tokens.
- **Payments:** NOWPayments REST API, HMAC-SHA512 IPN webhook verification, D1-backed idempotent state machine.
- **Transactional Email:** Resend (admin password reset + customer email verification — optional, disabled until Worker secrets are provisioned).
- **Testing:** Vitest (156 total tests: 132 Worker unit/integration tests with in-memory D1 mock + 24 Frontend tests).
- **CI/CD & Hosting:** GitHub Actions, Cloudflare Pages, Cloudflare Workers.
- **Observability:** Cloudflare Workers Observability (invocation logs, 100% head sampling rate) enabled in both development and production environments.

---

## 📄 License

MIT License — DreamWebApp Platform.
