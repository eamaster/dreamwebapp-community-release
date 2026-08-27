-- ============================================================
-- DreamWebApp D1 Migration: 0003_contact_phone
-- Additive only — does not modify 0001_initial.sql or 0002_*.sql.
--
-- Adds an optional visitor phone number to contact_messages so leads can
-- supply an internationally formatted phone number (E.164) alongside email.
-- NULL means the visitor did not supply a phone number.
-- ============================================================

ALTER TABLE contact_messages ADD COLUMN phone TEXT;
