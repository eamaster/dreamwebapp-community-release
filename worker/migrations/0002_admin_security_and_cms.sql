-- ============================================================
-- DreamWebApp D1 Migration: 0002_admin_security_and_cms
-- Additive only — does not modify 0001_initial.sql.
--
-- Adds:
--   1. password_reset_tokens — admin password-reset flow state
--   2. legal_pages           — CMS-editable Privacy Policy / Terms
--   3. media_assets          — metadata for uploaded logo images (R2)
--   4. site_settings.header_logo_asset_id / footer_logo_asset_id
-- ============================================================

-- ── 1. password_reset_tokens ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_user_id   INTEGER NOT NULL REFERENCES admin_users(id),
    token_hash      TEXT    NOT NULL UNIQUE,
    expires_at      TEXT    NOT NULL,
    consumed_at     TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_admin_user_id ON password_reset_tokens(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- ── 2. legal_pages ───────────────────────────────────────────────────────────
-- Fixed row set ('privacy-policy', 'terms-of-service'). Seeded unpublished
-- with empty body — no legal prose is invented by this migration.

CREATE TABLE IF NOT EXISTS legal_pages (
    id              TEXT    PRIMARY KEY,
    title           TEXT    NOT NULL,
    body            TEXT    NOT NULL DEFAULT '',
    is_published    INTEGER NOT NULL DEFAULT 0,
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO legal_pages (id, title, body, is_published) VALUES
    ('privacy-policy', 'Privacy Policy', '', 0),
    ('terms-of-service', 'Terms of Service', '', 0);

-- ── 3. media_assets ──────────────────────────────────────────────────────────
-- Metadata only. Binary content lives in the (optional) R2 bucket keyed by
-- r2_key; opaque server-generated ids/keys, never derived from filenames.

CREATE TABLE IF NOT EXISTS media_assets (
    id              TEXT    PRIMARY KEY,
    r2_key          TEXT    NOT NULL,
    content_type    TEXT    NOT NULL,
    size_bytes      INTEGER NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── 4. site_settings: header/footer logo references ─────────────────────────

ALTER TABLE site_settings ADD COLUMN header_logo_asset_id TEXT;
ALTER TABLE site_settings ADD COLUMN footer_logo_asset_id TEXT;
