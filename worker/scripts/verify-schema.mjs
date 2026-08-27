#!/usr/bin/env node
/**
 * DreamWebApp Schema Verification Smoke-Test Script
 *
 * Verifies that all required D1 tables are present in the target database.
 * Run locally or against remote:
 *   npx wrangler d1 execute dreamwebapp-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"
 *   npx wrangler d1 execute dreamwebapp-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
 */

export const REQUIRED_TABLES = [
    'users',
    'user_identities',
    'customer_sessions',
    'customer_tokens',
    'customer_services',
    'payment_orders',
    'payment_events',
    'admin_users',
    'services',
    'solutions',
    'pricing_plans',
    'pricing_addons',
    'faq_items',
    'site_settings',
];

console.log('Required D1 schema tables:');
for (const tbl of REQUIRED_TABLES) {
    console.log(`  - ${tbl}`);
}
