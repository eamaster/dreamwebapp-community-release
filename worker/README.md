# DreamWebApp Backend API (Cloudflare Worker)

High-performance, edge-first Headless CMS and data layer for the DreamWebApp frontend, built on Cloudflare Workers, Hono.js, Drizzle ORM, Cloudflare D1 (Serverless SQLite), and Cloudflare KV.

---

## 🏗️ Architecture & Features

- **Runtime:** Native Cloudflare Workers (V8 isolates at 300+ edge locations).
- **Web Framework:** [Hono.js](https://hono.dev/) v4 (ultra-fast, typed web framework).
- **ORM & Database:** [Drizzle ORM](https://orm.drizzle.team/) + Cloudflare D1.
- **Caching:** Multi-tier edge caching (Edge Cache-Control ➔ `CONTENT_KV` ➔ D1).
- **Authentication:** Web Crypto API JWT (HS256) & PBKDF2-SHA256 password hashing (zero external crypto dependencies).
- **Password Reset:** Self-service admin "forgot password" flow via [Resend](https://resend.com) transactional email — outbound-only, optional (disabled with a safe `503` until its two Worker secrets are set). See "Password Reset (Resend)" below.
- **Object Storage:** Optional Cloudflare **R2** bucket for admin-uploaded header/footer logos — binary data never touches D1/KV. See "Logo Uploads (R2)" below.
- **Phone Validation:** `libphonenumber-js` normalizes/validates both the site's own contact phone and visitor-supplied lead phone to E.164 — no hand-rolled country-code list.
- **Legal Content:** CMS-editable, unpublished-by-default Privacy Policy / Terms of Service pages. See "Legal Pages" below.
- **Validation:** Zod v3 schemas for all incoming write operations and submissions.
- **Rate Limiting:** Sliding-window anti-spam rate limiter on lead submissions (`rl:ip:endpoint` stored in KV).
- **Runtime:** Native Cloudflare Workers (V8 isolates at 300+ edge locations).
- **Web Framework:** [Hono.js](https://hono.dev/) v4 (ultra-fast, typed web framework).
- **ORM & Database:** [Drizzle ORM](https://orm.drizzle.team/) + Cloudflare D1 (Serverless SQLite).
- **Caching:** Multi-tier edge caching (Edge Cache-Control ➔ `CONTENT_KV` ➔ D1).
- **Admin Authentication:** Web Crypto API JWT (HS256) & PBKDF2-SHA256 password hashing.
- **Customer Authentication:** Revocable httpOnly session cookies, domain-scoped CSRF double-submit protection, PKCE OAuth (Google & X/Twitter) with canonical frontend redirection, single-use hashed email-verification and password-reset tokens.
- **Crypto Payments:** Non-custodial cryptocurrency checkout via NOWPayments with HMAC-SHA512 IPN webhook verification and idempotent entitlement state transitions.
- **Password Reset & Verification:** Outbound-only transactional email via [Resend](https://resend.com) (admin reset + customer verification).
- **Object Storage:** Optional Cloudflare **R2** bucket for admin-uploaded header/footer logos.
- **Phone Validation:** `libphonenumber-js` normalizes/validates contact phone numbers to E.164.
- **Legal Content:** CMS-editable Privacy Policy / Terms of Service pages.
- **Validation:** Zod v3 schemas for all incoming write operations and submissions.
- **Rate Limiting:** Sliding-window anti-spam rate limiter on lead submissions and payments (`rl:ip:endpoint` stored in KV).
- **AI Chat:** Narrow chatbot MVP (`POST /api/v1/chat`) grounded in the site's own public content, powered by the Cloudflare **Workers AI** binding (no API key required).

---

## 📁 Directory Structure

```
worker/
├── migrations/
│   ├── 0001_initial.sql                        # Core schema & seed data
│   ├── 0002_admin_security_and_cms.sql         # Password reset, legal pages, media assets, logo columns
│   ├── 0003_contact_phone.sql                  # Adds contact_messages.phone (optional, E.164)
│   ├── 0004_admin_account_email_change.sql      # Admin email-change verification table
│   ├── 0005_payment_orders.sql                 # payment_orders and payment_events tables (NOWPayments)
│   └── 0006_customer_accounts_and_services.sql # users, user_identities, customer_sessions, customer_tokens, customer_services
├── scripts/
│   ├── generate-password-hash.mjs              # Local PBKDF2 hash generator for admin bootstrap
│   ├── seed-legal-drafts.mjs                   # Generates Privacy Policy / Terms draft SQL
│   └── verify-schema.mjs                       # Verification script for D1 tables and health
├── .dev.vars.example                           # Template for local Worker secrets (copy → .dev.vars, gitignored)
├── src/
│   ├── db/
│   │   ├── index.ts                  # Drizzle client factory
│   │   └── schema.ts                 # All 18 D1 table definitions & relations
│   ├── lib/
│   │   ├── admin-customer-service.ts # Admin customer management (list, disable)
│   │   ├── ai-provider.ts            # AI provider adapter (Cloudflare Workers AI)
│   │   ├── customer-auth-service.ts  # Customer auth core (register, login, session, OAuth PKCE, canonical redirects)
│   │   ├── email-provider.ts         # Resend transactional email adapter (admin reset + customer verification)
│   │   ├── knowledge.ts              # Builds the chat's knowledge context from public content
│   │   ├── media-assets.ts           # R2 logo upload validation/storage adapter (optional binding)
│   │   ├── payments/                 # NOWPayments crypto checkout integration
│   │   │   ├── catalog.ts            # Server-authoritative plan catalog
│   │   │   ├── money.ts              # Decimal string arithmetic & minimum amount checks
│   │   │   ├── nowpayments-client.ts # NOWPayments REST API client
│   │   │   ├── repository.ts         # Order & event D1 operations + state transitions
│   │   │   ├── types.ts              # Payment schemas and internal status types
│   │   │   └── webhook.ts            # HMAC-SHA512 IPN signature verification
│   │   ├── prompt.ts                 # System prompt + deterministic handoff-intent detection
│   │   ├── reset-token.ts            # Secure token generation/hashing for reset flows
│   │   └── social-links.ts           # Canonical social-link normalization (site_settings.footer_json)
│   ├── middleware/
│   │   ├── auth.ts                   # Admin JWT validation, sign, PBKDF2 hash
│   │   ├── cache.ts                  # KV cache helpers (kvGet, kvSet, kvInvalidate)
│   │   ├── customer-auth.ts          # Customer httpOnly session + domain-scoped CSRF double-submit
│   │   └── ratelimit.ts              # Sliding-window KV rate limiter
│   ├── routes/
│   │   ├── __tests__/
│   │   │   ├── helpers/d1-mock.ts    # Shared in-memory D1 mock
│   │   │   ├── assets.test.ts        # R2 media asset upload/streaming tests
│   │   │   ├── cookie-csrf-cors.test.ts # CSRF, cookie domain, and CORS integration tests
│   │   │   ├── customer-auth.test.ts # Customer auth, OAuth PKCE, canonical redirects (24 tests)
│   │   │   └── payments.test.ts      # NOWPayments checkout and webhook tests
│   │   ├── account.ts                # Customer self-service (/api/v1/account/* — session required)
│   │   ├── admin.ts                  # Admin CMS CRUD + customer management (/api/v1/admin/* — JWT required)
│   │   ├── chat.ts                   # AI chatbot (/api/v1/chat)
│   │   ├── contact.ts                # Public lead capture (/api/v1/contact)
│   │   ├── content.ts                # Public cached content (/api/v1/content/*)
│   │   ├── customer-auth.ts          # Customer auth (/api/v1/auth/* — register, login, OAuth, verification)
│   │   ├── payments.ts               # Payment checkout & order status (/api/v1/payments/*)
│   │   └── webhooks.ts               # NOWPayments IPN webhook (/api/v1/webhooks/nowpayments)
│   ├── types/
│   │   └── env.ts                    # App Env: Cloudflare.Env + JWT/Resend/OAuth/Payment secrets
│   ├── validators/
│   │   └── schemas.ts                # Zod schemas for writes & requests
│   └── index.ts                      # Application entrypoint & middleware mounting
├── drizzle.config.ts                 # Drizzle Kit configuration
├── package.json                      # Worker dependencies & scripts
├── tsconfig.json                     # TypeScript configuration
├── vitest.config.ts                  # Vitest configuration
├── worker-configuration.d.ts        # Generated Cloudflare types
└── wrangler.jsonc                    # Cloudflare deployment configuration (keep_vars: true)
```

---

## 🗄️ Database Tables (Cloudflare D1)

1. `site_settings`: Global brand name, tagline, description, navigation JSON, footer JSON (sections, social links, copyright), contact email/phone (E.164), and `header_logo_asset_id` / `footer_logo_asset_id` references.
2. `services`: AI chatbot & automation offerings (`name`, `icon`, `pricingJson`, `whoItsForJson`, `includedJson`, `timeline`, `sortOrder`).
3. `solutions`: Industry-specific solutions (`title`, `icon`, `description`, `painsJson`, `benefitsJson`, `ctaText`).
4. `pricing_plans`: Recurring tiers (`monthlyPrice`, `setupFee`, `bestFor`, `featuresJson`, `badge`, `isHighlighted`).
5. `pricing_addons`: Add-on services (`price`, `priceType: one-time | monthly`).
6. `faqs`: Frequently asked questions with categories and sort order.
7. `contact_messages`: Inbound leads captured from `ContactForm.tsx` with audit IP and status (`unread`, `read`, `archived`). Includes an optional `phone` (E.164, nullable) alongside the optional `website`.
8. `admin_users`: Admin accounts with PBKDF2 password hashes and roles (`super_admin`, `editor`).
9. `password_reset_tokens`: One-way SHA-256 digests of admin password-reset tokens, with expiry and consumed state.
10. `legal_pages`: CMS-editable Privacy Policy / Terms of Service (`title`, `body`, `isPublished`).
11. `media_assets`: Metadata for uploaded header/footer logo images (`r2Key`, `contentType`, `sizeBytes`). Binary image data lives only in R2.
12. `admin_email_changes`: Hashed verification tokens for pending admin email updates.
13. `payment_orders`: Cryptographic payment records for NOWPayments checkouts (`orderId`, `internalStatus`, `priceAmount`, `payAmount`, `payAddress`, `entitlementGrantedAt`).
14. `payment_events`: Append-only audit log of IPN webhook events with `UNIQUE (event_fingerprint)` for idempotent delivery.
15. `users`: Customer accounts (`email`, `emailVerified`, `passwordHash`, `displayName`, `tokenVersion`, `disabledAt`).
16. `user_identities`: Linked authentication providers (`password`, `google`, `x`) per customer user.
17. `customer_sessions`: Revocable customer sessions (`sessionTokenHash`, `expiresAt`, `revokedAt`).
18. `customer_tokens`: Single-use hashed tokens for customer email verification and password reset (`tokenHash`, `purpose`).
19. `customer_services`: Service entitlements provisioned after successful payment (`userId`, `orderId`, `planKey`, `status`, `startedAt`, `expiresAt`).

---

## 🚀 Local Development

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Apply Migrations (Local D1 SQLite)

```bash
npx wrangler d1 migrations apply dreamwebapp-db --local
```

### 3. Configure Local Secrets

Admin login and JWT signing require `JWT_SECRET` even locally:

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars — JWT_SECRET is required; RESEND_* optional (password reset stays 503 until both are set)
```

### 4. Start the Worker Server

```bash
npx wrangler dev --local
```

The Worker will start on **`http://127.0.0.1:8787`**.

The `AI` binding (Cloudflare Workers AI) works out of the box under `wrangler dev` — no `.dev.vars` entry is needed for chat. It authenticates using your logged-in Wrangler/Cloudflare account, so run `npx wrangler login` once if you haven't already. If the binding can't reach Workers AI (offline, account restrictions, etc.), `POST /api/v1/chat` still responds successfully with a deterministic "temporarily unavailable" message instead of failing.

---

## 🔑 Secrets, Bindings & URLs (Worker)

Canonical full inventory (frontend vars, GitHub Actions, live URLs): see the root [Configuration & Credentials Reference](../README.md#-configuration--credentials-reference-private-repo). Worker-specific summary:

| Kind | Name | Required | Set via |
|---|---|---|---|
| Secret | `JWT_SECRET` | **Yes** | `wrangler secret put JWT_SECRET --env production` / `worker/.dev.vars` locally |
| Secret | `RESEND_API_KEY` | No | Same — enables password-reset email |
| Secret | `RESEND_FROM_EMAIL` | No | Same — verified Resend sender address |
| Binding | `DB` | **Yes** | `wrangler.jsonc` → D1 `00000000-0000-0000-0000-000000000000` |
| Binding | `CONTENT_KV` | **Yes** | `wrangler.jsonc` → KV `00000000000000000000000000000000` (preview: `00000000000000000000000000000001`) |
| Binding | `LOGO_ASSETS` | No (configured in prod) | R2 bucket `your-r2-bucket-name` |
| Binding | `AI` | **Yes** (for chat) | `wrangler.jsonc` `ai.binding` — **no API key** |
| Var | `CORS_ORIGIN` | **Yes** | `wrangler.jsonc` `vars` — comma-separated origins |
| Var | `ENVIRONMENT` | **Yes** | `development` locally / `production` in `env.production` |

**Production Worker URL:** `https://api.yourdomain.com`  
**Deploy command:** `npx wrangler deploy --env production` (Worker name on Cloudflare: `dreamwebapp-api-production`)  
**External API called by Worker:** `https://api.resend.com/emails` (password reset only; requires `RESEND_API_KEY`)

**Never commit:** actual values for `JWT_SECRET`, `RESEND_*`, `CLOUDFLARE_API_TOKEN`, or generated admin password hashes.

---

## 🤖 AI Chat Assistant (`POST /api/v1/chat`)

A deliberately narrow chatbot MVP — not a general-purpose assistant.

| Concern | Implementation |
|---|---|
| Request validation | `ChatRequestSchema` (Zod) in `src/validators/schemas.ts` — bounded array (1–20 messages), `role` restricted to `user`/`assistant` (never `system`), each message ≤ 1000 chars, combined ≤ 6000 chars |
| Rate limiting | Same `rateLimiter()` middleware as `/contact`, tuned to 20 req / 10 min per IP (`rl:chat:*` KV keys) |
| Knowledge grounding | `src/lib/knowledge.ts` reads the same KV-cached/D1 public content as `/api/v1/content/*` (site, services, solutions, pricing, FAQ) and normalizes it into a bounded text context — no separate content source, no vector DB |
| System prompt | `src/lib/prompt.ts` — defines scope, factual boundary, and conversation style; never sent to or trusted from the client |
| Human handoff | Deterministic keyword detection (`isHandoffIntent`) short-circuits the AI call entirely and returns a `{ action: { type: 'handoff' } }` response pointing at `/contact` |
| AI provider | `src/lib/ai-provider.ts` — adapter around the Cloudflare Workers AI `AI` binding (`@cf/meta/llama-3.1-8b-instruct-fp8`), with a 15s timeout and typed failure states (`not_configured`, `timeout`, `provider_error`) |
| Fallback | Any provider failure returns HTTP 200 with an honest "temporarily unavailable" message + a link to `/contact` — never a fabricated answer, never a 500 with internal details |
| Caching | Explicit `Cache-Control: no-store` — replies are personalized and must never be cached |

---

## 🔐 Creating or Resetting Admin Users

There is no default admin account or password baked into this repository — production must never accept a predictable, repository-visible password. If a password matching one previously published in project documentation was ever deployed, treat it as compromised and rotate it immediately using the steps below.

### Create the first admin account (one-time, operator-run)

1. Generate a PBKDF2 hash for a strong password of your own choosing. This script runs locally with Node's built-in Web Crypto implementation — the password and hash are never sent anywhere or written to a file:

   ```bash
   node worker/scripts/generate-password-hash.mjs
   # Follow the prompt to enter a password; copy the printed hash.
   ```

2. Insert the admin user using your own email and the generated hash (substitute both values — never commit them):

   ```bash
   npx wrangler d1 execute dreamwebapp-db --local --command="INSERT OR REPLACE INTO admin_users (id, email, password_hash, role, is_active) VALUES (1, 'YOUR_ADMIN_EMAIL', 'YOUR_GENERATED_HASH', 'super_admin', 1);"
   ```

   Use `--remote` instead of `--local` to seed the production database.

### Rotating a password afterwards

Once deployed with the password-reset feature enabled (see "Password Reset (Resend)" below), use the **"Forgot password?"** link on `/admin/login` — this is the supported, audited way to rotate a password without direct database access. Direct-database rotation (steps above) remains available as a break-glass procedure if email delivery is unavailable.

---

## 📧 Password Reset (Resend)

The admin "Forgot password?" flow (`/admin/forgot-password` → email link → `/admin/reset-password`) sends its email through [Resend](https://resend.com) via a direct `fetch` call in `src/lib/email-provider.ts` — no additional npm dependency, no provider-selection UI, no second vendor.

**This is outbound-only and scoped to admin password reset.** It does not add an inbound inbox, a support helpdesk, or any handling of incoming email — that remains explicitly out of scope for this release.

### Enabling it

1. Create a Resend account and verify a sending domain (or use their sandbox domain during testing).
2. Set the two required Worker secrets (never place these in `.env`/Vite config — they are Worker-only):

   ```bash
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put RESEND_FROM_EMAIL
   # e.g. "DreamWebApp <no-reply@yourdomain.com>" — must be a verified Resend sender
   ```

3. Confirm `CORS_ORIGIN` (in `wrangler.jsonc`) starts with your real production frontend origin — the reset email's link is built from it (`{origin}/admin/reset-password?token=...`).

### Behavior when not configured

Until both secrets are set, `POST /api/v1/admin/auth/request-reset` returns a clear `503` "not available" error instead of claiming an email was sent, and no token or reset link is ever exposed to the client. Once configured, `request-reset` always returns the same generic success message whether or not the email matches an account, to prevent account enumeration.

Reset tokens are single-use, expire after 30 minutes, and only a SHA-256 digest is ever stored (`password_reset_tokens.token_hash`) — a database read alone can never produce a usable token.

Admin sessions are stateless JWTs (HS256, 8-hour expiry). Each token carries the account's `token_version` at sign time; a successful password reset (or email change, below) bumps `admin_users.token_version`, and `jwtMiddleware` rejects any token whose `tv` claim no longer matches — so a reset immediately invalidates every already-issued session, not just new logins. Tokens signed before this existed have no `tv` claim and are left unchecked until they naturally expire.

---

## ✉️ Changing the Admin Login Email

**The admin login email is only an account identifier stored in `admin_users.email` — it does not create or move a mailbox.** Password reset (above) and the verification step below only work if that address is an inbox you can actually open: a real personal/company mailbox, or a domain address forwarded to one you control (e.g. via [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/)). Pointing it at an address nobody reads will permanently lock out password recovery.

The in-app flow (Admin Dashboard → **Account & Security**) is only available once Resend is configured (see above), because the new address must be verified before anything changes:

1. Authenticated admin submits their **current password** + a **new email** (`POST /api/v1/admin/account/change-email/request`).
2. A one-time, 30-minute, single-use verification link is emailed to the **new** address only — the current address is never notified and nothing changes yet.
3. Opening the link and confirming (`POST /api/v1/admin/account/change-email/confirm`, public — same shape as password reset) commits the new email, bumps `token_version` to invalidate every existing session, and requires signing in again.

This reuses the same hashed/expiring/one-use `password_reset_tokens` primitive as password reset, distinguished by a `purpose` column (`'password_reset' | 'email_change'`) added in `migrations/0004_admin_account_email_change.sql` — no second token system.

If Resend isn't configured, the request endpoint returns a `503` and the admin UI explains why instead of pretending the change completed.

### Operator runbook: activating Resend (external, manual, no secrets in this repo)

**Current status:** only `JWT_SECRET` is set on the production Worker — `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are **not** configured yet, so password reset and email-change stay safely disabled (`503`) until an operator completes this runbook. If an API key was ever pasted into a chat, ticket, screenshot, or any place outside a secrets manager, treat it as compromised — revoke it in the Resend dashboard and create a replacement before doing anything else below; never reuse an exposed key.

1. **Resend domain + sender (external, one-time):**
   - Add your company domain in the [Resend dashboard](https://resend.com/domains) and add only the exact DNS records Resend generates to your authoritative DNS provider. Wait for Resend to mark the domain **verified** — do not assume existing SPF/DKIM/MX/Cloudflare Email Routing records already satisfy this.
   - Choose a verified sender address for automated security mail only, e.g. `security@yourdomain.com` or `no-reply@yourdomain.com` — keep it separate from any address humans use for support replies.
   - Create a new restricted, sending-only API key (after revoking any previously exposed key).
2. **Worker secrets (operator's own terminal — never share the key with anyone else, including in this chat):**

   ```bash
   cd worker
   npx wrangler whoami                                    # confirm the intended Cloudflare account
   npx wrangler secret put RESEND_API_KEY --env production
   npx wrangler secret put RESEND_FROM_EMAIL --env production
   ```

   Each command opens its own secure prompt — paste the value there, not as a command-line argument, so it never lands in shell history. `RESEND_FROM_EMAIL` must exactly match the verified sender chosen above.
3. **Confirm activation:** reload the admin dashboard's **Account & Security** tab — `GET /api/v1/admin/capabilities` should report `passwordResetEmailConfigured: true`. Only then run an end-to-end test: request a reset for a real admin address, confirm the email arrives at the operator-controlled inbox, and confirm the link works once and expires after use.
4. **Inbound company mail (separate from the above, and entirely manual/external):** if you also want human-readable company addresses (`admin@`, `support@`, `hello@`), configure them in [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/) forwarding to an inbox you control — keep that route distinct from the Resend transactional sender above, avoid a broad catch-all route initially, and avoid combining it with another inbound MX provider without a deliberate plan. This repository never creates mailboxes, inbound routing rules, or DNS records automatically.

---

## 🖼️ Logo Uploads (R2)

Admin-managed header/footer logos (`POST/DELETE /api/v1/admin/assets/logo?target=header|footer`, served publicly via `GET /api/v1/content/assets/:id`) are stored in an **optional** Cloudflare R2 bucket. Binary image data is never stored in D1, KV, or content JSON.

The admin dashboard calls `GET /api/v1/admin/capabilities` (booleans only, no bucket/provider details) on load so the Branding UI can proactively disable the upload control and explain *why*, instead of only failing after an attempted upload.

### Status

R2 is enabled on the production Cloudflare account and the `LOGO_ASSETS` binding (bucket `your-r2-bucket-name`) is already configured in both the top-level and `env.production` sections of `wrangler.jsonc`. Logo upload/replace/remove is live once the Worker carrying this binding is deployed.

### Enabling it from scratch (reference, e.g. a new environment)

1. **R2 must first be enabled on the Cloudflare account itself** (a one-time, dashboard-only action — Cloudflare requires accepting R2 terms before any bucket can be created; `wrangler r2 bucket create` fails with `error code 10042` until this is done). This cannot be done via Wrangler/CI and is not something this codebase can trigger automatically.
2. Once R2 is enabled, create a bucket (choose your own name; not created automatically by this codebase):

   ```bash
   npx wrangler r2 bucket create <your-bucket-name>
   ```

3. Add the binding to `wrangler.jsonc` (both the top-level and `env.production` sections), matching the binding name `LOGO_ASSETS` expected by `src/types/env.ts`:

   ```jsonc
   "r2_buckets": [
     { "binding": "LOGO_ASSETS", "bucket_name": "<your-bucket-name>" }
   ]
   ```

4. Redeploy the Worker.

### Behavior when not configured

If the `LOGO_ASSETS` binding is ever absent (e.g. a fresh environment before step 3 above), upload requests return a clear `503` "not configured" error and the public `/content/assets/:id` route returns `404`. Header/Footer always fall back to the built-in static brand logo in this case — no broken images.

### Security

- Admin-only (existing JWT middleware), 2MB size limit, PNG/JPEG/WebP only.
- The declared content type is verified against the file's actual magic bytes — never trusted from the filename/extension alone.
- Stored objects use an opaque, server-generated key (`logos/<uuid>.<ext>`) — never the original filename.
- Replacing/removing a logo only deletes the underlying R2 object once no `site_settings` column still references it.

---

## ⚖️ Legal Pages (Privacy Policy / Terms of Service)

`legal_pages` is a fixed two-row table (`privacy-policy`, `terms-of-service`) with `title`, `body` (plain text, rendered as paragraphs split on blank lines — never raw HTML/`dangerouslySetInnerHTML`), and `isPublished`.

- **Public behavior:** `GET /api/v1/content/legal/:id` returns `data: null` while `isPublished = 0`. The public route (`/privacy-policy`, `/terms-of-service`) shows a neutral "hasn't been published yet" message in that case — it never renders draft content to visitors.
- **Draft content:** `worker/scripts/seed-legal-drafts.mjs` generates a SQL file that populates both rows with admin-editable **draft** text (it does not change `isPublished`). Regenerate/apply it with:

  ```bash
  node worker/scripts/seed-legal-drafts.mjs worker/scripts/.legal-drafts.sql
  npx wrangler d1 execute dreamwebapp-db --remote --file=worker/scripts/.legal-drafts.sql
  # (the generated .sql file is gitignored — delete it after applying)
  ```

- **Publishing:** an administrator must open Admin → Legal, review/replace the bracketed placeholders (business name, jurisdiction, retention period, privacy contact email), and save with "Published" checked (`PUT /api/v1/admin/legal/:id`) before either page becomes publicly visible.
- **Never invent legal prose in code.** If you need to change the seeded draft, edit the template strings in `seed-legal-drafts.mjs`, not `LegalPage.tsx` or any route handler.

---

## 🌐 Production Deployment

### 1. Authenticate with Cloudflare

```bash
# Set your API token (in CI/CD or terminal):
export CLOUDFLARE_API_TOKEN="your-api-token"
```

### 2. Create Cloudflare D1 Database & KV Namespace

```bash
# Create production D1 database
npx wrangler d1 create dreamwebapp-db
# Copy the returned database_id into wrangler.jsonc under d1_databases[0].database_id

# Create production KV namespace
npx wrangler kv namespace create CONTENT_KV
# Copy the returned id and preview_id into wrangler.jsonc under kv_namespaces[0]
```

Optional — only needed to enable logo uploads (see "Logo Uploads (R2)" below for the full flow, including the one-time dashboard step Cloudflare requires before the first bucket can be created):

```bash
npx wrangler r2 bucket create your-r2-bucket-name
# Add the LOGO_ASSETS binding to wrangler.jsonc (both top-level and env.production)
```

### 3. Set Production Secrets

```bash
npx wrangler secret put JWT_SECRET
# Enter a secure, random string (e.g. openssl rand -base64 32)
```

Optional secrets — set only once you're ready to enable the corresponding feature (see "Password Reset (Resend)" and "Logo Uploads (R2)" above for full context):

```bash
npx wrangler secret put RESEND_API_KEY      # enables admin password-reset email
npx wrangler secret put RESEND_FROM_EMAIL   # must be a verified Resend sender
```

### 4. Apply Migrations to Production D1

```bash
npx wrangler d1 migrations apply dreamwebapp-db --remote
```

### 5. Deploy Worker

```bash
npx wrangler deploy --env production
```

Your API will be live at:
`https://api.yourdomain.com`

---

## 📡 API Endpoints Summary

### Public
- `GET /` — API health check
- `GET /api/v1/content/site` — Site branding, navigation, contact, footer (social links, logos)
- `GET /api/v1/content/services` — List of active services
- `GET /api/v1/content/solutions` — List of active solutions
- `GET /api/v1/content/pricing` — Pricing plans & add-ons
- `GET /api/v1/content/faq` — Published FAQs
- `GET /api/v1/content/legal/:id` — Published legal page (`privacy-policy` | `terms-of-service`); returns `data: null` if unpublished
- `GET /api/v1/content/assets/:id` — Public logo asset delivery (long-lived cache; 404 if R2 not configured or asset missing)
- `POST /api/v1/contact` — Lead capture form submission (Rate-limited; also used by the chat widget's human handoff). Accepts an optional `phone` (validated E.164 when supplied) alongside the optional `website` field — neither is required.
- `POST /api/v1/chat` — Narrow AI chatbot MVP (Rate-limited, 20 req / 10 min per IP). Grounded in public content only; deterministically detects "talk to a human" intent; degrades to an honest fallback message if the AI provider is unavailable. See below.
- `POST /api/v1/admin/auth/request-reset` — Request an admin password-reset email (Rate-limited; always returns a generic result)
- `POST /api/v1/admin/auth/reset-password` — Consume a reset token and set a new password (Rate-limited)
- `POST /api/v1/admin/account/change-email/confirm` — Consume an email-change verification token and commit the new admin email (Rate-limited)

### Admin (Bearer Token Required)
- `POST /api/v1/admin/auth/login` — Sign in and receive JWT token (Rate-limited)
- `GET/PUT /api/v1/admin/site` — Site settings (brand, contact, navigation, footer/social links, logo references)
- `GET /api/v1/admin/capabilities` — Which optional integrations (logo storage, password-reset email) are configured — booleans only, no secrets/provider details
- `POST /api/v1/admin/account/change-email/request` — Request an admin-email-change verification link (requires current password; 503 if Resend isn't configured)
- `GET/POST/PUT/DELETE /api/v1/admin/services` — Services CRUD
- `GET/POST/PUT/DELETE /api/v1/admin/solutions` — Solutions CRUD
- `GET/POST/PUT/DELETE /api/v1/admin/pricing/plans` — Plans CRUD
- `GET/POST/PUT/DELETE /api/v1/admin/pricing/addons` — Add-ons CRUD
- `GET/POST/PUT/DELETE /api/v1/admin/faq` — FAQs CRUD
- `GET/PUT /api/v1/admin/legal` / `/api/v1/admin/legal/:id` — Legal pages CRUD
- `POST /api/v1/admin/assets/logo?target=header|footer` — Upload/replace a logo (503 if R2 not configured)
- `DELETE /api/v1/admin/assets/logo?target=header|footer` — Remove a logo (falls back to default brand logo)
- `GET/PUT /api/v1/admin/contacts` — Contact lead inquiries
