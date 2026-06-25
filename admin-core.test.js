import { decodeBase64ToUtf8, putWithShaRetry, encodeToBase64 } from './admin-core.js';
import { jest } from '@jest/globals';

describe('decodeBase64ToUtf8', () => {
    it('should decode simple ASCII Base64 strings', () => {
        const input = btoa('Hello World');
        const output = decodeBase64ToUtf8(input);
        expect(output).toBe('Hello World');
    });

    it('should decode Base64 encoded UTF-8 strings (Hebrew text)', () => {
        const originalText = 'שלום עולם';
        const encoder = new TextEncoder();
        const bytes = encoder.encode(originalText);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        const encoded = btoa(binary);

        const output = decodeBase64ToUtf8(encoded);
        expect(output).toBe(originalText);
    });

    it('should decode Base64 encoded UTF-8 strings containing emojis', () => {
        const originalText = 'Hello 🌍';
        const encoder = new TextEncoder();
        const bytes = encoder.encode(originalText);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        const encoded = btoa(binary);

        const output = decodeBase64ToUtf8(encoded);
        expect(output).toBe(originalText);
    });

    it('should handle empty string input', () => {
        const output = decodeBase64ToUtf8('');
        expect(output).toBe('');
    });
});

describe('putWithShaRetry', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = window.fetch;
    });

    afterEach(() => {
        window.fetch = originalFetch;
        jest.clearAllMocks();
    });

    it('should succeed on the first try if the response is ok', async () => {
        window.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ success: true })
        });

        const res = await putWithShaRetry('http://example.com/api', { content: 'test' }, 'dummy_token');
        expect(res.ok).toBe(true);
        expect(window.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 409 conflict, refetch latest content, and succeed', async () => {
        // First PUT fails with 409
        // Refetch GET succeeds, returns new sha
        // Second PUT succeeds

        window.fetch = jest.fn()
            // First PUT (fails)
            .mockResolvedValueOnce({
                ok: false,
                status: 409,
                text: jest.fn().mockResolvedValue('Conflict')
            })
            // Refetch GET (succeeds)
            .mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    sha: 'new_sha_123',
                    content: encodeToBase64(JSON.stringify({ some: 'data' }))
                })
            })
            // Second PUT (succeeds)
            .mockResolvedValueOnce({
                ok: true,
                status: 200
            });

        const res = await putWithShaRetry('http://example.com/api', { content: 'test' }, 'dummy_token');
        expect(res.ok).toBe(true);
        expect(window.fetch).toHaveBeenCalledTimes(3);

        // Check if the second PUT request used the new SHA
        const secondPutCall = window.fetch.mock.calls[2];
        const bodyUsed = JSON.parse(secondPutCall[1].body);
        expect(bodyUsed.sha).toBe('new_sha_123');
    });

    it('should apply transformFn correctly when retrying after 409 conflict', async () => {
        const transformFn = jest.fn((latestContent) => {
            return encodeToBase64(JSON.stringify({ ...latestContent, added: 'yes' }));
        });

        window.fetch = jest.fn()
            // First PUT (fails)
            .mockResolvedValueOnce({
                ok: false,
                status: 409,
                text: jest.fn().mockResolvedValue('Conflict')
            })
            // Refetch GET (succeeds)
            .mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    sha: 'new_sha_123',
                    content: encodeToBase64(JSON.stringify({ old: 'data' }))
                })
            })
            // Second PUT (succeeds)
            .mockResolvedValueOnce({
                ok: true,
                status: 200
            });

        const res = await putWithShaRetry('http://example.com/api', { content: 'test' }, 'dummy_token', null, 3, transformFn);
        expect(res.ok).toBe(true);
        expect(window.fetch).toHaveBeenCalledTimes(3);
        expect(transformFn).toHaveBeenCalledTimes(1);

        // Check if the second PUT request used the updated content from transformFn
        const secondPutCall = window.fetch.mock.calls[2];
        const bodyUsed = JSON.parse(secondPutCall[1].body);
        expect(bodyUsed.content).toBe(encodeToBase64(JSON.stringify({ old: 'data', added: 'yes' })));
    });

    it('should throw an error if max retries are exceeded (e.g. 500 errors)', async () => {
        window.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: jest.fn().mockResolvedValue('Internal Server Error')
        });

        await expect(putWithShaRetry('http://example.com/api', { content: 'test' }, 'dummy_token', null, 2))
            .rejects
            .toThrow(/GitHub PUT failed: 500 Internal Server Error/);

        // 2 PUT requests + 2 GET refetch requests = 4 calls total
        // Note: admin-core.js tries to refetch on 500 if attempt < maxRetries.
        // Attempt 1: PUT (500) -> GET refetch
        // Attempt 2: PUT (500) -> throws
        expect(window.fetch).toHaveBeenCalledTimes(3);
    });
});
