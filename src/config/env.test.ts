import { describe, it, expect } from 'vitest';
import { getValidatedApiBaseUrl } from './env';

describe('Environment API Base URL Validation', () => {
    describe('Production environment (isProd = true)', () => {
        it('accepts canonical production HTTPS url https://api.example.com', () => {
            const url = getValidatedApiBaseUrl('https://api.example.com', true);
            expect(url).toBe('https://api.example.com');
        });

        it('accepts canonical production HTTPS url with trailing slash and normalizes to origin', () => {
            const url = getValidatedApiBaseUrl('https://api.example.com/', true);
            expect(url).toBe('https://api.example.com');
        });

        it('rejects deprecated workers.dev hostname', () => {
            expect(() =>
                getValidatedApiBaseUrl('https://my-worker.example.workers.dev', true)
            ).toThrow(/Obsolete workers\.dev hostname rejected/);
        });

        it('rejects any other workers.dev domain', () => {
            expect(() =>
                getValidatedApiBaseUrl('https://custom-app.workers.dev', true)
            ).toThrow(/Obsolete workers\.dev hostname rejected/);
        });

        it('rejects non-HTTPS production URLs', () => {
            expect(() =>
                getValidatedApiBaseUrl('http://api.example.com', true)
            ).toThrow(/Production API base URL must use HTTPS/);
        });

        it('rejects URLs with embedded credentials', () => {
            expect(() =>
                getValidatedApiBaseUrl('https://admin:secret@api.example.com', true)
            ).toThrow(/must not include credentials/);
        });

        it('rejects URLs with query parameters or hash fragments', () => {
            expect(() =>
                getValidatedApiBaseUrl('https://api.example.com?token=123', true)
            ).toThrow(/must not contain query parameters or fragments/);

            expect(() =>
                getValidatedApiBaseUrl('https://api.example.com#section', true)
            ).toThrow(/must not contain query parameters or fragments/);
        });

        it('rejects URLs with path components', () => {
            expect(() =>
                getValidatedApiBaseUrl('https://api.example.com/api/v1', true)
            ).toThrow(/must not include a path component/);
        });

        it('rejects malformed URLs', () => {
            expect(() =>
                getValidatedApiBaseUrl('not-a-valid-url', true)
            ).toThrow(/Invalid VITE_API_BASE_URL format/);
        });
    });

    describe('Development environment (isProd = false)', () => {
        it('defaults to http://localhost:8787 if no input provided', () => {
            const url = getValidatedApiBaseUrl(undefined, false);
            expect(url).toBe('http://localhost:8787');
        });

        it('accepts custom localhost port in development', () => {
            const url = getValidatedApiBaseUrl('http://127.0.0.1:8787', false);
            expect(url).toBe('http://127.0.0.1:8787');
        });

        it('rejects workers.dev in development', () => {
            expect(() =>
                getValidatedApiBaseUrl('https://my-worker.example.workers.dev', false)
            ).toThrow(/Obsolete workers\.dev hostname rejected/);
        });
    });
});
