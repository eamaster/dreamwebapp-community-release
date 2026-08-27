-- ============================================================
-- DreamWebApp D1 Migration: 0006_customer_accounts_and_services
-- Adds customer accounts, identities, revocable sessions,
-- one-time verification tokens, and service entitlements.
-- ============================================================

-- ── 1. users ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id                 TEXT    PRIMARY KEY,
    email              TEXT    UNIQUE,
    email_verified     INTEGER NOT NULL DEFAULT 0,
    email_verified_at  TEXT,
    password_hash      TEXT,
    display_name       TEXT,
    avatar_url         TEXT,
    token_version      INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    disabled_at        TEXT
);

-- ── 2. user_identities ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_identities (
    id                 TEXT    PRIMARY KEY,
    user_id            TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider           TEXT    NOT NULL CHECK (provider IN ('password', 'google', 'x')),
    provider_subject   TEXT    NOT NULL,
    provider_email     TEXT,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user_id ON user_identities (user_id);

-- ── 3. customer_sessions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_sessions (
    id                 TEXT    PRIMARY KEY,
    user_id            TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash TEXT    NOT NULL UNIQUE,
    expires_at         TEXT    NOT NULL,
    last_used_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    revoked_at         TEXT,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_user_active
    ON customer_sessions (user_id, revoked_at, expires_at);

-- ── 4. customer_tokens ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_tokens (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash         TEXT    NOT NULL UNIQUE,
    purpose            TEXT    NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
    pending_email      TEXT,
    expires_at         TEXT    NOT NULL,
    consumed_at        TEXT,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── 5. customer_services ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_services (
    id                 TEXT    PRIMARY KEY,
    user_id            TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id           TEXT    NOT NULL UNIQUE,
    plan_key           TEXT    NOT NULL,
    service_name       TEXT    NOT NULL,
    status             TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'provisioning', 'completed', 'suspended', 'cancelled')),
    started_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at         TEXT,
    next_review_at     TEXT,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customer_services_user_status
    ON customer_services (user_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_created
    ON payment_orders (user_id, created_at);
