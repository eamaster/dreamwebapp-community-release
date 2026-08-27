-- ============================================================
-- DreamWebApp D1 Migration: 0005_payment_orders
-- Adds payment_orders and payment_events tables for the
-- NOWPayments hosted-invoice checkout flow.
-- ============================================================

-- ── 12. payment_orders ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_orders (
    order_id                      TEXT    PRIMARY KEY,
    -- Auth: status_token_hash (for public polling) or user_id (for authenticated users)
    status_token_hash             TEXT,
    user_id                       TEXT,
    plan_key                      TEXT    NOT NULL,
    billing_mode                  TEXT    NOT NULL CHECK (billing_mode IN ('one_time', 'setup', 'monthly')),
    -- Authoritative price stored as decimal string to avoid float errors
    expected_price_amount_decimal TEXT    NOT NULL,
    price_currency                TEXT    NOT NULL,
    pay_currency                  TEXT    NOT NULL,
    -- Populated once the NOWPayments invoice is created
    expected_pay_amount_decimal   TEXT,
    provider_invoice_id           TEXT,
    -- UNIQUE: one payment ID can only belong to one order
    provider_payment_id           TEXT    UNIQUE,
    internal_status               TEXT    NOT NULL DEFAULT 'pending'
                                          CHECK (internal_status IN ('pending','waiting','confirming','partially_paid','paid','failed','expired','refunded')),
    provider_status               TEXT,
    entitlement_granted_at        TEXT,
    created_at                    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at                    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_provider_payment_id
    ON payment_orders (provider_payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_orders_internal_status
    ON payment_orders (internal_status);

-- ── 13. payment_events ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_events (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id             TEXT    NOT NULL,
    provider_payment_id  TEXT    NOT NULL,
    provider_status      TEXT    NOT NULL,
    -- SHA-256 of "${orderId}:${providerPaymentId}:${providerStatus}"
    -- UNIQUE prevents processing the same status transition twice
    event_fingerprint    TEXT    NOT NULL UNIQUE,
    -- SHA-256 of the full raw IPN body (for audit; no sensitive data stored)
    payload_hash         TEXT    NOT NULL,
    received_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_events_order_id
    ON payment_events (order_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_fingerprint
    ON payment_events (event_fingerprint);
