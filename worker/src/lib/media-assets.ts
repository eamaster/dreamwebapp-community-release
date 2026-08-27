/**
 * Logo asset storage adapter — Cloudflare R2 (optional binding).
 *
 * Binary image data is only ever kept in R2, never in D1/KV/content JSON.
 * `media_assets` (D1) stores only metadata (opaque id, R2 key, content type,
 * size) so the rest of the CMS can reference an asset by a stable id.
 *
 * The R2 binding (`env.LOGO_ASSETS`) is optional: until an operator
 * provisions the bucket and adds the binding to wrangler.jsonc, every
 * function here fails closed with a typed, non-throwing result so upload
 * routes can respond with a clear "not configured" error instead of a crash.
 */

import type { Env } from '../types/env';

export const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type AllowedLogoType = (typeof ALLOWED_LOGO_TYPES)[number];

export function isAllowedLogoType(value: unknown): value is AllowedLogoType {
    return typeof value === 'string' && (ALLOWED_LOGO_TYPES as readonly string[]).includes(value);
}

const EXTENSION_BY_TYPE: Record<AllowedLogoType, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
};

export type LogoValidationResult =
    | { ok: true; contentType: AllowedLogoType }
    | { ok: false; error: string };

/**
 * Validates a declared content type against the file's magic bytes.
 * Never trusts the declared type/extension alone.
 */
export function validateLogoUpload(bytes: Uint8Array, declaredType: string): LogoValidationResult {
    if (bytes.byteLength === 0) {
        return { ok: false, error: 'The uploaded file is empty.' };
    }
    if (bytes.byteLength > MAX_LOGO_BYTES) {
        return { ok: false, error: `File exceeds the ${MAX_LOGO_BYTES / (1024 * 1024)}MB size limit.` };
    }

    const sniffed = sniffImageType(bytes);
    if (!sniffed) {
        return { ok: false, error: 'File must be a PNG, JPEG, or WebP image.' };
    }

    const normalizedDeclared = declaredType.toLowerCase().trim();
    if (normalizedDeclared !== sniffed) {
        return { ok: false, error: 'The file content does not match its declared type.' };
    }

    return { ok: true, contentType: sniffed };
}

function sniffImageType(bytes: Uint8Array): AllowedLogoType | null {
    if (bytes.length >= 8 &&
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
        bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
        return 'image/png';
    }
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'image/jpeg';
    }
    if (bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
        return 'image/webp';
    }
    return null;
}

export function isLogoStorageConfigured(env: Env): boolean {
    return Boolean(env.LOGO_ASSETS);
}

/** Relative public URL a logo asset is served from (see contentRouter `GET /assets/:id`). */
export function assetUrl(assetId: string | null | undefined): string | null {
    return assetId ? `/api/v1/content/assets/${assetId}` : null;
}

export interface StoredLogoAsset {
    id: string;
    r2Key: string;
    contentType: AllowedLogoType;
    sizeBytes: number;
}

/** Uploads validated bytes to R2 under an opaque, server-generated key. */
export async function putLogoAsset(
    env: Env,
    bytes: Uint8Array,
    contentType: AllowedLogoType
): Promise<StoredLogoAsset | null> {
    if (!env.LOGO_ASSETS) return null;

    const id = crypto.randomUUID();
    const r2Key = `logos/${id}.${EXTENSION_BY_TYPE[contentType]}`;

    await env.LOGO_ASSETS.put(r2Key, bytes, {
        httpMetadata: { contentType },
    });

    return { id, r2Key, contentType, sizeBytes: bytes.byteLength };
}

/** Best-effort delete from R2 — failures are swallowed (metadata row is the source of truth for references). */
export async function deleteLogoAssetFromStorage(env: Env, r2Key: string): Promise<void> {
    if (!env.LOGO_ASSETS) return;
    try {
        await env.LOGO_ASSETS.delete(r2Key);
    } catch {
        // Non-fatal — an orphaned R2 object is not a correctness issue.
    }
}
