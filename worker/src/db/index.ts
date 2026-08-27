/**
 * Drizzle ORM client factory.
 * Accepts a D1Database binding from the Cloudflare Worker env
 * and returns a fully-typed Drizzle client.
 */

import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export type DrizzleDB = ReturnType<typeof createDB>;

export function createDB(d1: D1Database) {
    return drizzle(d1, { schema, logger: false });
}
