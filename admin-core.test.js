import { decodeBase64ToUtf8, sendPushNotification } from './admin-core.js';
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
            text: jest.fn().mockResolvedValue('success')
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
        expect(fetchArgs[0]).toBe("https://onesignal.com/api/v1/notifications");
        expect(fetchArgs[1].method).toBe("POST");
        expect(fetchArgs[1].headers.Authorization).toBe("Basic local-rest-key");

        const payload = JSON.parse(fetchArgs[1].body);
        expect(payload.app_id).toBe("test-app-id");
        expect(payload.headings.en).toBe("Test Title");
        expect(payload.contents.en).toBe("Test Message");
        expect(payload.included_segments).toEqual(["Subscribed Users"]);
        expect(mockLog).toHaveBeenCalledWith("Push notification sent successfully!");
    });

    it('should set filters in payload for updates (isUpdate = true)', async () => {

        window.localStorage.setItem('onesignal_rest_key', 'local-rest-key');


        await sendPushNotification('Test Title', 'Test Message', true);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const fetchArgs = mockFetch.mock.calls[0];
        const payload = JSON.parse(fetchArgs[1].body);
        expect(payload.included_segments).toBeUndefined();
        expect(payload.filters).toEqual([
            { "field": "tag", "key": "subscribe_updates", "relation": "=", "value": "true" }
        ]);
    });

    it('should fallback to GitHub API for appId if not in DOM', async () => {
        document.body.innerHTML = '<input id="site-onesignal-rest" value="test-rest-key">';

        window.localStorage.setItem('onesignal_rest_key', 'local-rest-key');


        const encodedConfig = btoa(unescape(encodeURIComponent(JSON.stringify({ oneSignalAppId: 'github-app-id' }))));
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue({ content: encodedConfig })
        });

        await sendPushNotification('Test Title', 'Test Message');

        expect(mockFetch).toHaveBeenCalledTimes(2);
        const onesignalFetchArgs = mockFetch.mock.calls[1];
        const payload = JSON.parse(onesignalFetchArgs[1].body);
        expect(payload.app_id).toBe("github-app-id");
    });

    it('should fallback to DOM configRestElement for restKey if not in localStorage', async () => {

        window.localStorage.removeItem('onesignal_rest_key');


        await sendPushNotification('Test Title', 'Test Message');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const fetchArgs = mockFetch.mock.calls[0];
        expect(fetchArgs[1].headers.Authorization).toBe("Basic test-rest-key");
    });

    it('should log error if OneSignal API response is not ok', async () => {

        window.localStorage.setItem('onesignal_rest_key', 'local-rest-key');

        mockFetch.mockResolvedValueOnce({
            ok: false,
            text: jest.fn().mockResolvedValue('API Error Details')
        });

        await sendPushNotification('Test Title', 'Test Message');

        expect(mockError).toHaveBeenCalledWith("Failed to send push notification:", "API Error Details");
    });

    it('should catch and log network errors', async () => {

        window.localStorage.setItem('onesignal_rest_key', 'local-rest-key');

        const networkError = new Error('Network failure');
        mockFetch.mockRejectedValueOnce(networkError);

        await sendPushNotification('Test Title', 'Test Message');

        expect(mockError).toHaveBeenCalledWith("Error sending push notification:", networkError);
    });
});
