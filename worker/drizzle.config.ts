import type { Config } from 'drizzle-kit';

export default {
    schema: './src/db/schema.ts',
    out: './migrations',
    dialect: 'sqlite',
    driver: 'd1-http',
    dbCredentials: {
        // Used for drizzle-kit studio / push. For migrations, use wrangler CLI.
        accountId: process.env['CLOUDFLARE_ACCOUNT_ID'] ?? '',
        databaseId: process.env['CLOUDFLARE_D1_DATABASE_ID'] ?? '',
        token: process.env['CLOUDFLARE_API_TOKEN'] ?? '',
    },
} satisfies Config;
