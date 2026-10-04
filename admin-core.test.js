import { decodeBase64ToUtf8, sendPushNotification, putWithShaRetry, encodeToBase64 } from './admin-core.js';
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

describe('encodeToBase64', () => {
    it('should encode simple ASCII strings', () => {
        const input = 'Hello World';
        const expectedOutput = btoa('Hello World');
        const output = encodeToBase64(input);
        expect(output).toBe(expectedOutput);
    });

    it('should encode UTF-8 strings (Hebrew text)', () => {
        const input = 'שלום עולם';
        const encoder = new TextEncoder();
        const bytes = encoder.encode(input);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        const expectedOutput = btoa(binary);

        const output = encodeToBase64(input);
        expect(output).toBe(expectedOutput);
    });

    it('should encode UTF-8 strings containing emojis', () => {
        const input = 'Hello 🌍';
        const encoder = new TextEncoder();
        const bytes = encoder.encode(input);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        const expectedOutput = btoa(binary);

        const output = encodeToBase64(input);
        expect(output).toBe(expectedOutput);
    });

    it('should handle empty string input', () => {
        const output = encodeToBase64('');
        expect(output).toBe('');
    });
});

describe('sendPushNotification', () => {
    let mockFetch;
    let mockWarn;
    let mockError;
    let mockLog;

    beforeEach(() => {
        document.body.innerHTML = `
            <input id="site-onesignal-id" value="test-app-id">
            <input id="site-onesignal-rest" value="test-rest-key">
        `;
        window.localStorage.clear();

if (mockFetch) mockFetch.mockClear();
        mockFetch = jest.spyOn(window, 'fetch').mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue('success'),
            json: jest.fn().mockResolvedValue({ success: true })
        });
        mockWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should skip notification and log warning if restKey or appIdStr is missing', async () => {
        document.body.innerHTML = '';

        window.localStorage.removeItem('onesignal_rest_key');

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue({ content: btoa(JSON.stringify({ oneSignalAppId: null })) })
        });

        await sendPushNotification('Test Title', 'Test Message');

        expect(mockWarn).toHaveBeenCalledWith("OneSignal REST Key or App ID differs/missing. Push notification skipped.");
        expect(mockFetch).toHaveBeenCalledTimes(1); // the fallback GitHub fetch
    });

    it('should send notification successfully using localStorage restKey and DOM appId', async () => {
        document.body.innerHTML = '<input id="site-onesignal-id" value="test-app-id">';

        window.localStorage.setItem('onesignal_rest_key', 'local-rest-key');


        await sendPushNotification('Test Title', 'Test Message');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const fetchArgs = mockFetch.mock.calls[0];
        // בגלל APPS_SCRIPT_URL הקריאה הולכת לשרת Apps Script
        expect(fetchArgs[1].method).toBe("POST");
        const body = JSON.parse(fetchArgs[1].body);
        expect(body.action).toBe("sendPush");
        expect(body.appId).toBe("test-app-id");
        expect(body.title).toBe("Test Title");
        expect(body.message).toBe("Test Message");
        expect(mockLog).toHaveBeenCalledWith("Push notification sent successfully via Apps Script!");
    });

    it('should set isUpdate=true in Apps Script payload for updates', async () => {

        window.localStorage.setItem('onesignal_rest_key', 'local-rest-key');


        await sendPushNotification('Test Title', 'Test Message', true);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const fetchArgs = mockFetch.mock.calls[0];
        const payload = JSON.parse(fetchArgs[1].body);
        expect(payload.isUpdate).toBe(true);
    });

    it('should fallback to GitHub API for appId if not in DOM', async () => {
        document.body.innerHTML = '<input id="site-onesignal-rest" value="test-rest-key">';

        window.localStorage.setItem('onesignal_rest_key', 'local-rest-key');


        const encodedConfig = btoa(unescape(encodeURIComponent(JSON.stringify({ oneSignalAppId: 'github-app-id' }))));
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue({ content: encodedConfig })
        });
        // second fetch: Apps Script
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue({ success: true })
        });

        await sendPushNotification('Test Title', 'Test Message');

        expect(mockFetch).toHaveBeenCalledTimes(2);
        const appsScriptArgs = mockFetch.mock.calls[1];
        const payload = JSON.parse(appsScriptArgs[1].body);
        expect(payload.appId).toBe("github-app-id");
    });

    it('should fallback to DOM configRestElement for restKey if not in localStorage', async () => {

        window.localStorage.removeItem('onesignal_rest_key');


        await sendPushNotification('Test Title', 'Test Message');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const fetchArgs = mockFetch.mock.calls[0];
        const body = JSON.parse(fetchArgs[1].body);
        expect(body.restKey).toBe("test-rest-key");
    });

    it('should log error if Apps Script returns non-ok response', async () => {

        window.localStorage.setItem('onesignal_rest_key', 'local-rest-key');

        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: jest.fn().mockResolvedValue({ error: 'Script Error' })
        });

        await sendPushNotification('Test Title', 'Test Message');

        // Apps Script שולח error ומחזיר early - לא קוראת שוב ישירות
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should catch and log network errors from Apps Script', async () => {

        window.localStorage.setItem('onesignal_rest_key', 'local-rest-key');

        const networkError = new Error('Network failure');
        mockFetch.mockRejectedValueOnce(networkError);

        await sendPushNotification('Test Title', 'Test Message');

        expect(mockError).toHaveBeenCalledWith("Apps Script push error:", networkError);
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
