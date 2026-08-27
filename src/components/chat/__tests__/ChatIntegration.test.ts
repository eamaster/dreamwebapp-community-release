import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { env } from '@/config/env';
import { sendChatMessage } from '@/lib/api-client';
import { chatContent } from '@/content/chat';

describe('Chat Widget Integration & Configuration Tests', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('uses the shared env.apiBaseUrl for the chat endpoint', async () => {
        let capturedUrl = '';
        let capturedBody = '';

        globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
            capturedUrl = url;
            capturedBody = init?.body as string;
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, reply: 'Hello from test assistant!' }),
            } as Response;
        });

        const res = await sendChatMessage({
            messages: [{ role: 'user', content: 'What are your chatbot offerings?' }],
        });

        expect(capturedUrl).toBe(`${env.apiBaseUrl}/api/v1/chat`);
        expect(JSON.parse(capturedBody)).toEqual({
            messages: [{ role: 'user', content: 'What are your chatbot offerings?' }],
        });
        expect(res.reply).toBe('Hello from test assistant!');
    });

    it('handles safe API error response without leaking internal errors', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: 'Invalid message payload' }),
        } as Response);

        await expect(
            sendChatMessage({
                messages: [{ role: 'user', content: '' }],
            })
        ).rejects.toThrow('Invalid message payload');
    });

    it('handles network failure with a safe user-facing message', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

        await expect(
            sendChatMessage({
                messages: [{ role: 'user', content: 'Hello' }],
            })
        ).rejects.toThrow(/Network error/);
    });

    it('contains valid accessibility content and starter prompts in chat content configuration', () => {
        expect(chatContent.disclosure).toBeTruthy();
        expect(chatContent.starterPrompts.length).toBeGreaterThan(0);
        chatContent.starterPrompts.forEach((sp) => {
            expect(sp.id).toBeTruthy();
            expect(sp.label).toBeTruthy();
            expect(sp.prompt).toBeTruthy();
        });
    });

    it('verifies enableChatWidget feature flag is boolean', () => {
        expect(typeof env.enableChatWidget).toBe('boolean');
    });
});
