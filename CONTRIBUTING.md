# Contributing to DreamWebApp Community Edition

Thank you for your interest in contributing to DreamWebApp! We welcome issues, bug fixes, features, and documentation improvements.

---

## Code of Conduct & Safety Guidelines

> [!CAUTION]
> **NEVER SUBMIT SECRETS OR PRODUCTION DATA**:
> - Never submit API keys, tokens, credentials, private certificates, or production identifiers.
> - Never submit customer data, user accounts, order records, or live database dumps.
> - Never commit `.env` or `worker/.dev.vars` files. Only update `.example` files with clearly fictitious values.

---

## Prerequisites

- **Node.js**: v22.x LTS or higher (CI uses Node 22)
- **npm**: v10.x or higher
- **Git**: v2.40 or higher

---

## Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/eamaster/dreamwebapp-community-release.git
   cd dreamwebapp-community-release
   ```

2. **Install dependencies**:
   ```bash
   npm ci
   npm ci --prefix worker
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   cp worker/.dev.vars.example worker/.dev.vars
   ```

   Generate a unique `JWT_SECRET` (32+ characters) in `worker/.dev.vars`. Do not reuse the placeholder.

4. **Initialize the local D1 database** (from the repository root):
   ```bash
   npm run db:migrate:local
   ```

   That applies `worker/migrations/0001_initial.sql` through `worker/migrations/0006_customer_accounts_and_services.sql` via Wrangler migrations. Prefer this over ad-hoc `d1 execute --file` so migration history stays consistent.

5. **Start development servers**:
   Terminal 1 (Worker API):
   ```bash
   npm run dev --prefix worker
   ```

   Terminal 2 (Vite frontend):
   ```bash
   npm run dev
   ```

Defaults are `http://localhost:8787` (API) and `http://localhost:5173` (frontend).

---

## Quality & Validation Gates

Before submitting a Pull Request, these checks must pass:

```bash
# 1. Lint
npm run lint

# 2. Frontend TypeScript project
npm run typecheck

# 3. Worker TypeScript project (uses the checked-in worker types file;
#    does not require Cloudflare credentials)
npm run typecheck:tsc --prefix worker

# 4. Full test suite (frontend + worker)
npm run test:all

# 5. Production frontend build with an operator API origin
VITE_API_BASE_URL=https://api.example.com npm run build
```

Notes:

- Root `npm run typecheck` covers the frontend (`src/` and `shared/`), including frontend unit tests included by `tsconfig.app.json`.
- Worker unit tests under `worker/src/**/__tests__` are excluded from `worker/tsconfig.json` and are exercised by Vitest, not `tsc`.
- A production frontend build **requires** `VITE_API_BASE_URL` (HTTPS operator origin). CI sets `https://api.example.com`.

---

## Submitting Pull Requests

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Commit with clear, descriptive messages.
3. Push and open a Pull Request against `main` on [dreamwebapp-community-release](https://github.com/eamaster/dreamwebapp-community-release).
4. Ensure CI passes all checks. CI does not deploy.
