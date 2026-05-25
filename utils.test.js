import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { fetchStaticJson } from './utils.js';

describe('fetchStaticJson', () => {
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;

    beforeEach(() => {
        // Silence console.error for clean test output
        console.error = () => {};
    });

    afterEach(() => {
        global.fetch = originalFetch;
        console.error = originalConsoleError;
    });

    it('should return parsed JSON when fetch is successful', async () => {
        const mockData = { items: [1, 2, 3] };
        global.fetch = async (url) => {
            assert.strictEqual(url, './data/news.json');
            return {
                ok: true,
                json: async () => mockData
            };
        };

        const result = await fetchStaticJson('news');
        assert.deepStrictEqual(result, mockData);
    });

    it('should return error object when response is not ok', async () => {
        global.fetch = async (url) => {
            return {
                ok: false
            };
        };

        const result = await fetchStaticJson('news');
        assert.deepStrictEqual(result, {
            error: true,
            message: 'אירעה שגיאה בטעינת הנתונים (JSON). נא לנסות שוב מאוחר יותר.'
        });
    });

    it('should return error object when fetch throws a network error', async () => {
        global.fetch = async (url) => {
            throw new Error('Network failure');
        };

        const result = await fetchStaticJson('gallery');
        assert.deepStrictEqual(result, {
            error: true,
            message: 'אירעה שגיאה בטעינת הנתונים (JSON). נא לנסות שוב מאוחר יותר.'
        });
    });
});
