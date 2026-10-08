# DreamWebApp Worker API (Community Edition)

Cloudflare Worker backend for the DreamWebApp Community Edition: public content, admin CMS, customer auth, optional crypto checkout, and a content-grounded chat route.

Operator setup, secrets, and deployment rules live in the repository root [README.md](../README.md). This Worker guide describes the API package only. Deployment is opt-in on **your** Cloudflare account. This repository's CI does not deploy.

## Stack

- Cloudflare Workers + [Hono](https://hono.dev/)
- [Drizzle ORM](https://orm.drizzle.team/) + Cloudflare D1
- Cloudflare KV (`CONTENT_KV`) for content and some rate-limit/session helpers
- Optional R2 (`LOGO_ASSETS`) for admin logo uploads
- Optional Workers AI binding for `POST /api/v1/chat`
- Optional Resend and NOWPayments via Worker secrets

## Shared modules

Reviewed helpers live in the repository-root `shared/` directory and are imported as `@shared/*` from both the frontend and this Worker (see `wrangler.jsonc` `alias`, `tsconfig.json` paths, and Vitest aliases):

- `shared/cms-checkout-amount.ts` — CMS fee selection (positive setup/activation fee, else monthly/access price)
- `shared/monetary-display.ts` — shared money formatting
- `shared/checkout-route.ts` — crypto checkout path builder

## CMS fees and sale policy

Crypto checkout amounts come from CMS plan fees via `worker/src/lib/commercial/cms-plan-amounts.ts`. Deploy-time `SERVER_CRYPTO_CATALOG` seed amounts are **never** charged.

`worker/src/lib/commercial/plan-sale-policy.ts` distinguishes:

1. **CMS `isActive`** — content record state
2. **Catalog `publicVisible`** — approved for public listing
3. **Catalog `checkoutEnabled`** — approved for crypto checkout
4. **Positive payable CMS amount** — required to charge

CMS-active alone does not make a plan publicly listed or checkout-eligible. Plans must also appear in the static community catalog (`starter-bot`, `growth-bot`, `pro-automation`) before they can be sold online. Custom CMS-only plans stay admin-managed until an operator adds a matching catalog entry in code.

## Layout

```
worker/
├── migrations/          # 0001 … 0006 (schema + sample content)
├── scripts/             # password-hash helper, schema verify, legal draft helper
├── src/
│   ├── db/              # Drizzle schema + client
│   ├── lib/
│   │   ├── commercial/  # CMS fee amounts + community sale policy
│   │   ├── payments/    # Catalog, money, NOWPayments, webhooks
│   │   └── …            # auth, email, knowledge, media, prompt
│   ├── middleware/      # admin JWT, customer session/CSRF, cache, rate limit
│   └── routes/          # content, contact, chat, admin, auth, account, payments, webhooks
├── wrangler.jsonc       # placeholders only — replace with your resources
└── wrangler.example.jsonc
```

## Scripts

From `worker/`:

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local Worker (`wrangler dev`) |
| `npm test` | Vitest suite (in-memory mocks; no Cloudflare/payment credentials) |
| `npm run typecheck:tsc` | `tsc --noEmit` against checked-in types |
| `npm run db:migrate:local` | Apply D1 migrations locally |
| `npm run deploy` | **Operator-owned** remote migrate + deploy — do not run until wrangler points at your resources |

From the repository root, prefer `npm run db:migrate:local`, `npm run test:worker`, and `npm run deploy:worker` wrappers.

## HTTP surface

Mounted from `src/index.ts`:

- `GET /health`
- `GET /api/v1/content/*`
- `POST /api/v1/contact`
- `POST /api/v1/chat`
- `/api/v1/admin/*`
- `/api/v1/auth/*`
- `/api/v1/account/*`
- `/api/v1/payments/*`
- `/api/v1/webhooks/*`

CORS reflects only origins listed in `CORS_ORIGIN`. Do not use a wildcard CORS origin with credentials.

## Local development

1. Copy `.dev.vars.example` → `.dev.vars` and set `JWT_SECRET`.
2. From the repo root: `npm run db:migrate:local`.
3. `npm run dev` in this directory (API defaults to `http://localhost:8787`).

OAuth redirect URIs, when used, must target the **Worker** origin (for local work, typically `http://localhost:8787/api/v1/auth/oauth/.../callback`), not the Vite origin, unless you add an explicit proxy.

`PUBLIC_APP_ORIGIN` and `COOKIE_DOMAIN` are configured in `wrangler.jsonc` `vars` (and production overrides). In production, `PUBLIC_APP_ORIGIN` must be your HTTPS site origin; password-reset and OAuth redirects do not substitute a built-in hosted brand.

## Optional integrations

Leave unset until needed. Unconfigured providers fail closed or report unavailability:

- Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- NOWPayments: `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, plus payment URL vars in `.dev.vars.example`
- Google / X OAuth: client id, secret, and redirect URI for each provider
- Workers AI: `AI` binding in wrangler

## Deploying on your account

Replace every placeholder in `wrangler.jsonc` / `wrangler.example.jsonc` (account id, D1 id, KV id, R2 bucket, domains) with resources you own. Review root README deploy guidance before running `npm run deploy`.