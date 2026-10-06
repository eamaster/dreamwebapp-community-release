# DreamWebApp Community Edition

Self-hosted marketing site and edge API for a small-business chatbot service. This repository is the community edition. It is meant to run on infrastructure you control.

This is not a hosted service, and the checks in this repository do not deploy anything.

## License

The code in this repository is licensed under the Apache License, Version 2.0. See `LICENSE` and `NOTICE`.

That license does not grant rights in the DreamWebApp name. The bundled sample pages are not your terms of service or privacy policy.

## What is included

The checked-in application includes:

- A React and Vite frontend for home, services, solutions, pricing, about, contact, account, checkout, and admin screens.
- A Cloudflare Worker API using Hono, Drizzle, D1, KV, optional R2, and an optional Workers AI binding.
- Admin access with a bearer JWT, PBKDF2 password hashes, and no default administrator account.
- Customer sessions stored as httpOnly cookies, with a CSRF double-submit cookie and Zod validation on writes.
- Optional Resend email for password reset and address verification. When it is not configured, those flows report that email is unavailable instead of pretending a message was sent.
- Optional Google and X sign-in. Each provider stays disabled until its client id, client secret, and redirect URI are set.
- Optional NOWPayments checkout. Checkout returns `PAYMENT_NOT_CONFIGURED` until the server-side API key is set. Webhook signatures are verified with the IPN secret.
- A chat route grounded in the site's public content. If the Workers AI binding is missing or the provider fails, the API returns a safe unavailable or handoff response.
- Sample services, prices, and contact details bundled with the app. Replace them before you use the site with your own visitors.

GitHub Actions runs install, lint, typecheck, tests, and a production frontend build. It does not deploy.

## Requirements

- Node.js 22
- npm 10 or newer
- A Cloudflare account only if you choose to deploy. Local checks do not need one.

## Install

```bash
git clone https://github.com/eamaster/dreamwebapp-community-release.git
cd dreamwebapp-community-release
npm ci
npm ci --prefix worker
cp .env.example .env
cp worker/.dev.vars.example worker/.dev.vars
```

Edit the copied files. Use your own origins and generate your own secrets. `.env` and `worker/.dev.vars` are gitignored.

`JWT_SECRET` in `worker/.dev.vars` must be a unique random string of at least 32 characters. Do not reuse the placeholder.

The example files contain placeholders only. Payment, email, and OAuth secrets belong in `worker/.dev.vars` or in Worker secrets. Do not put them in `VITE_*` variables.

## Local database

From the repository root:

```bash
npm run db:migrate:local
```

That applies `worker/migrations/0001_initial.sql` through `worker/migrations/0006_customer_accounts_and_services.sql` to a local D1 database named `dreamwebapp-db`. Use the same command on an existing local database to apply any later migrations. The migrations are schema and sample content. They do not create an administrator.

Create an administrator only on your own database. Generate a hash with `node worker/scripts/generate-password-hash.mjs`, then insert it yourself. The script reads the password from the terminal and does not store a default password in the repository.

## Run locally

Terminal 1:

```bash
npm run dev --prefix worker
```

Terminal 2:

```bash
npm run dev
```

The defaults are `http://localhost:8787` for the API and `http://localhost:5173` for the frontend. `worker/wrangler.jsonc` allows the local frontend origin. Replace `yourdomain.com` before any deployment. Do not use a wildcard CORS origin.

There is no default administrator password. Until you insert an administrator row, `/admin/login` has no account to accept.

## Checks

```bash
npm run lint
npm run typecheck
npm run test:all
VITE_API_BASE_URL=https://api.example.com npm run build
```

`npm run typecheck` covers the frontend TypeScript project. The Worker project is checked with:

```bash
npm run typecheck --prefix worker
```

A production frontend build requires `VITE_API_BASE_URL` and rejects non-HTTPS values, embedded credentials, paths, queries, and `workers.dev` hosts. CI sets `https://api.example.com` for that build. For your own deployment, set the variable to your API origin.

Worker tests use in-memory mocks. They do not need Cloudflare credentials or a live payment provider.

## Routes

Frontend routes include `/`, `/services`, `/solutions`, `/pricing`, `/about`, `/contact`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/account`, `/privacy-policy`, `/terms-of-service`, `/checkout/crypto`, `/payment/return`, `/admin/login`, and `/admin`.

API routes include:

- `GET /health`
- `GET /api/v1/content/*`
- `POST /api/v1/contact`
- `POST /api/v1/chat`
- `/api/v1/admin/*`
- `/api/v1/auth/*`
- `/api/v1/account/*`
- `/api/v1/payments/*`
- `/api/v1/webhooks/*`

CORS reflects only origins listed in `CORS_ORIGIN`. Credentialed browser calls from other origins are not authorized.

## Optional integrations

Leave a provider unset if you do not use it.

- Resend: `RESEND_API_KEY` and `RESEND_FROM_EMAIL`
- NOWPayments: `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET`, plus the payment URL settings in `worker/.dev.vars.example`
- Google sign-in: `CUSTOMER_AUTH_GOOGLE_CLIENT_ID`, `CUSTOMER_AUTH_GOOGLE_CLIENT_SECRET`, and `CUSTOMER_AUTH_GOOGLE_REDIRECT_URI`
- X sign-in: `CUSTOMER_AUTH_X_CLIENT_ID`, `CUSTOMER_AUTH_X_CLIENT_SECRET`, and `CUSTOMER_AUTH_X_REDIRECT_URI`
- Chat: the `AI` binding in `worker/wrangler.jsonc`

`PUBLIC_APP_ORIGIN` is the frontend origin used in email links and redirects. Set it to your site. Customer password reset and OAuth do not substitute a built-in host.

## Deploying on your account

Deployment is optional. Review `worker/wrangler.jsonc` and replace every placeholder account id, database id, KV id, bucket name, and domain before you deploy. Create those resources in your own Cloudflare account.

The npm script `deploy:worker` applies remote migrations and then runs `wrangler deploy`. Do not run it until the configuration points at resources you own. This repository's GitHub Actions workflow does not contain deployment credentials and does not deploy on push.

A production Worker environment should set `ENVIRONMENT` to `production`, `PUBLIC_APP_ORIGIN` to your HTTPS site origin, and `COOKIE_DOMAIN` to the parent domain shared by that site and the API. The Worker rejects a cookie domain that is not a parent of the configured HTTPS CORS origins.

## Sample content

Services, solutions, prices, FAQs, and contact details under `src/content/` and in the database migrations are sample content for this edition. They are not your live catalog. Edit them, or replace them through the admin CMS, before inviting visitors.

Legal pages are unpublished until an administrator publishes them. Do not present the bundled drafts as legal advice or as a completed policy.

## Security contact

`SECURITY.md` still uses `security@example.com` as a placeholder. Use a maintainer-provided contact before reporting a vulnerability.
