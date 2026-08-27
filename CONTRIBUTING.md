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

- **Node.js**: v22.x LTS or higher
- **npm**: v10.x or higher
- **Git**: v2.40 or higher

---

## Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/dreamwebapp-community.git
   cd dreamwebapp-community
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

4. **Initialize local D1 SQLite database**:
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

5. **Start development servers**:
   In terminal 1 (Worker API):
   ```bash
   npm run dev --prefix worker
   ```

   In terminal 2 (Vite Frontend):
   ```bash
   npm run dev
   ```

---

## Quality & Validation Gates

Before submitting a Pull Request, all automated checks must pass:

```bash
# 1. Lint code
npm run lint

# 2. Typecheck TypeScript across frontend & worker
npm run typecheck

# 3. Run full test suite
npm run test:all

# 4. Validate frontend production build
npm run build
```

---

## Submitting Pull Requests

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Commit your changes with clear, descriptive commit messages.
3. Push to your branch and open a Pull Request against `main`.
4. Ensure CI passes all checks.
