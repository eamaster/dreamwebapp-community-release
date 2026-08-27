#!/usr/bin/env node
/**
 * Generates a PBKDF2 password hash in the exact format expected by
 * `worker/src/middleware/auth.ts` (`hashPassword` / `verifyPassword`):
 *
 *   pbkdf2:<iterations>:<base64 salt>:<base64 hash>
 *
 * Runs entirely locally using Node's built-in Web Crypto implementation.
 * Nothing is written to disk, logged remotely, or transmitted anywhere —
 * only the resulting hash is printed to stdout for you to copy into a
 * `wrangler d1 execute` INSERT statement.
 *
 * Usage:
 *   node worker/scripts/generate-password-hash.mjs
 */

import { webcrypto as crypto } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ITERATIONS = 100_000;

async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const hashBuffer = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
        keyMaterial,
        256
    );

    const saltB64 = Buffer.from(salt).toString('base64');
    const hashB64 = Buffer.from(hashBuffer).toString('base64');

    return `pbkdf2:${ITERATIONS}:${saltB64}:${hashB64}`;
}

function isStrongEnough(password) {
    return password.length >= 12 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

async function main() {
    const rl = createInterface({ input: stdin, output: stdout });
    let password;
    try {
        password = await rl.question('Enter a new admin password (min 12 chars, letters + numbers): ');
    } finally {
        rl.close();
    }

    if (!isStrongEnough(password)) {
        console.error('\nPassword must be at least 12 characters and include both letters and numbers. Nothing was generated.');
        process.exitCode = 1;
        return;
    }

    const hash = await hashPassword(password);
    console.log('\nGenerated password hash (copy the value below into your INSERT statement):\n');
    console.log(hash);
    console.log('\nThis hash is not stored anywhere by this script. Do not commit it to version control.');
}

main();
