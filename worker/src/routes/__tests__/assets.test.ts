import { describe, it, expect } from 'vitest';
import app from '../../index';
import type { Env } from '../../types/env';

function createMockD1(customRows: Record<string, unknown[]> = {}): D1Database {
    return {
        prepare(query: string) {
            let boundParams: unknown[] = [];
            const stmt = {
                bind(...params: unknown[]) {
                    boundParams = params;
                    return stmt;
                },
                async all() {
                    for (const [tableOrColumn, rows] of Object.entries(customRows)) {
                        if (query.includes(tableOrColumn)) {
                            if (boundParams.length > 0) {
                                const filtered = rows.filter((r) => (r as Record<string, unknown>)['id'] === boundParams[0]);
                                return { results: filtered, success: true, meta: {} };
                            }
                            return { results: rows, success: true, meta: {} };
                        }
                    }
                    return { results: [], success: true, meta: {} };
                },
                async raw() {
                    const res = await stmt.all();
                    return res.results.map((r) => Object.values(r as Record<string, unknown>));
                },
                async first(col?: string) {
                    const res = await stmt.all();
                    const firstRow = res.results[0] as Record<string, unknown> | undefined;
                    if (!firstRow) return null;
                    return col ? firstRow[col] : firstRow;
                },
                async run() {
                    return { success: true, meta: {} };
                },
            } as unknown as D1PreparedStatement;
            return stmt;
        },
        async batch() {
            return [];
        },
        async exec() {
            return { count: 0, duration: 0 };
        },
        async dump() {
            return new ArrayBuffer(0);
        },
    } as unknown as D1Database;
}

function createMockR2(objects: Record<string, { body: Uint8Array; contentType: string; etag: string; uploaded: Date }>): R2Bucket {
    return {
        async get(key: string) {
            const found = objects[key];
            if (!found) return null;

            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(found.body);
                    controller.close();
                },
            });

            return {
                key,
                version: '1',
                size: found.body.byteLength,
                etag: found.etag,
                httpEtag: `"${found.etag}"`,
                uploaded: found.uploaded,
                httpMetadata: { contentType: found.contentType },
                customMetadata: {},
                body: stream,
                bodyUsed: false,
                arrayBuffer: async () => found.body.buffer,
                text: async () => new TextDecoder().decode(found.body),
                json: async () => JSON.parse(new TextDecoder().decode(found.body)),
                blob: async () => new Blob([found.body]),
                writeHttpMetadata: (headers: Headers) => {
                    headers.set('content-type', found.contentType);
                },
            } as unknown as R2ObjectBody;
        },
        async head(key: string) {
            const found = objects[key];
            if (!found) return null;

            return {
                key,
                version: '1',
                size: found.body.byteLength,
                etag: found.etag,
                httpEtag: `"${found.etag}"`,
                uploaded: found.uploaded,
                httpMetadata: { contentType: found.contentType },
                customMetadata: {},
                writeHttpMetadata: (headers: Headers) => {
                    headers.set('content-type', found.contentType);
                },
            } as unknown as R2Object;
        },
        async put() {
            return null as unknown as R2Object;
        },
        async delete() {},
        async list() {
            return { objects: [], truncated: false } as unknown as R2Objects;
        },
    } as unknown as R2Bucket;
}

const mockDate = new Date('2026-08-24T12:00:00Z');
const mockPngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const validAssetRow = {
    id: '11111111-2222-3333-4444-555555555555',
    r2Key: 'logos/11111111-2222-3333-4444-555555555555.png',
    contentType: 'image/png',
    sizeBytes: mockPngBytes.byteLength,
    createdAt: mockDate.toISOString(),
};

const corruptedAssetRow = {
    id: 'corrupted-asset-id',
    r2Key: 'logos/corrupted.exe',
    contentType: 'application/x-msdownload',
    sizeBytes: 100,
    createdAt: mockDate.toISOString(),
};

function createTestEnv(overrides: Partial<Env> = {}): Env {
    return {
        ENVIRONMENT: 'test',
        CORS_ORIGIN: 'https://dreamwebapp.com',
        JWT_SECRET: 'test-jwt-secret-min-32-chars-long-example',
        DB: createMockD1({
            media_assets: [validAssetRow, corruptedAssetRow],
        }),
        LOGO_ASSETS: createMockR2({
            [validAssetRow.r2Key]: {
                body: mockPngBytes,
                contentType: 'image/png',
                etag: 'etag-valid-png',
                uploaded: mockDate,
            },
        }),
        CONTENT_KV: {
            get: async () => null,
            put: async () => {},
            delete: async () => {},
        } as unknown as KVNamespace,
        ...overrides,
    } as Env;
}

describe('Logo Asset & CORP Security Policy Suite', () => {
    it('serves a valid image asset with Cross-Origin-Resource-Policy: cross-origin and proper security headers', async () => {
        const env = createTestEnv();
        const res = await app.request('/api/v1/content/assets/11111111-2222-3333-4444-555555555555', {
            method: 'GET',
        }, env);

        expect(res.status).toBe(200);
        expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
        expect(res.headers.get('Content-Type')).toBe('image/png');
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
        expect(res.headers.get('ETag')).toBe('"etag-valid-png"');
        expect(res.headers.get('Last-Modified')).toBe(mockDate.toUTCString());

        const body = await res.arrayBuffer();
        expect(new Uint8Array(body)).toEqual(mockPngBytes);
    });

    it('handles HEAD request on asset route without transferring body', async () => {
        const env = createTestEnv();
        const res = await app.request('/api/v1/content/assets/11111111-2222-3333-4444-555555555555', {
            method: 'HEAD',
        }, env);

        expect(res.status).toBe(200);
        expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
        expect(res.headers.get('Content-Type')).toBe('image/png');
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
        expect(res.headers.get('ETag')).toBe('"etag-valid-png"');

        const text = await res.text();
        expect(text).toBe('');
    });

    it('returns 304 Not Modified when If-None-Match matches ETag', async () => {
        const env = createTestEnv();
        const res = await app.request('/api/v1/content/assets/11111111-2222-3333-4444-555555555555', {
            method: 'GET',
            headers: {
                'If-None-Match': '"etag-valid-png"',
            },
        }, env);

        expect(res.status).toBe(304);
        expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
        expect(res.headers.get('ETag')).toBe('"etag-valid-png"');
        const text = await res.text();
        expect(text).toBe('');
    });

    it('returns 304 Not Modified when If-Modified-Since is equal to or newer than object upload time', async () => {
        const env = createTestEnv();
        const res = await app.request('/api/v1/content/assets/11111111-2222-3333-4444-555555555555', {
            method: 'GET',
            headers: {
                'If-Modified-Since': new Date('2026-08-24T13:00:00Z').toUTCString(),
            },
        }, env);

        expect(res.status).toBe(304);
        expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
        const text = await res.text();
        expect(text).toBe('');
    });

    it('returns 404 with Cross-Origin-Resource-Policy: same-origin for missing asset ID in D1', async () => {
        const env = createTestEnv();
        const res = await app.request('/api/v1/content/assets/non-existent-uuid', {
            method: 'GET',
        }, env);

        expect(res.status).toBe(404);
        expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
        const json = await res.json();
        expect(json).toEqual({ error: 'Asset not found' });
    });

    it('returns 404 with Cross-Origin-Resource-Policy: same-origin when asset metadata has corrupted/non-allowed MIME type', async () => {
        const env = createTestEnv();
        const res = await app.request('/api/v1/content/assets/corrupted-asset-id', {
            method: 'GET',
        }, env);

        expect(res.status).toBe(404);
        expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
        const json = await res.json();
        expect(json).toEqual({ error: 'Asset not found' });
    });

    it('returns 404 with Cross-Origin-Resource-Policy: same-origin when R2 bucket is unconfigured', async () => {
        const env = createTestEnv({ LOGO_ASSETS: undefined });
        const res = await app.request('/api/v1/content/assets/11111111-2222-3333-4444-555555555555', {
            method: 'GET',
        }, env);

        expect(res.status).toBe(404);
        expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
        const json = await res.json();
        expect(json).toEqual({ error: 'Asset storage is not configured' });
    });

    it('preserves Cross-Origin-Resource-Policy: same-origin on standard JSON and health endpoints', async () => {
        const env = createTestEnv();

        const healthRes = await app.request('/health', { method: 'GET' }, env);
        expect(healthRes.status).toBe(200);
        expect(healthRes.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
        expect(healthRes.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(healthRes.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');

        const notFoundRes = await app.request('/api/v1/unknown-endpoint', { method: 'GET' }, env);
        expect(notFoundRes.status).toBe(404);
        expect(notFoundRes.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    });
});
