-- ============================================================
-- DreamWebApp D1 Migration: 0004_admin_account_email_change
-- Additive only — does not modify 0001_initial.sql, 0002_*.sql, or 0003_*.sql.
--
-- 1. admin_users.token_version — lets a password reset or a verified
--    admin-email change invalidate already-issued JWTs (which are otherwise
--    stateless) by bumping a counter that jwtMiddleware compares against the
--    token's own `tv` claim. Existing rows default to 0; tokens signed
--    before this migration omit `tv` entirely and are treated as
--    compatible (grace period) until they naturally expire.
--
-- 2. password_reset_tokens.purpose / new_email — generalizes the existing
--    hashed, expiring, one-use reset-token table so the same primitive can
--    also carry a pending admin-email change through verification, without
--    changing the meaning of existing rows (which default to
--    purpose = 'password_reset', new_email = NULL).
-- ============================================================

ALTER TABLE admin_users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE password_reset_tokens ADD COLUMN purpose TEXT NOT NULL DEFAULT 'password_reset';
ALTER TABLE password_reset_tokens ADD COLUMN new_email TEXT;
