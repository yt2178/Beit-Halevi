import { encodeToBase64, decodeBase64ToUtf8 } from './admin-core.js';
import { jest } from '@jest/globals';

describe('encodeToBase64', () => {
    it('should correctly encode ascii string', () => {
        const result = encodeToBase64("hello world");
        expect(result).toBe("aGVsbG8gd29ybGQ=");
    });

    it('should correctly encode empty string', () => {
        const result = encodeToBase64("");
        expect(result).toBe("");
    });

    it('should correctly encode special characters', () => {
        const result = encodeToBase64("!@#$%^&*()");
        expect(result).toBe("IUAjJCVeJiooKQ==");
    });

    it('should correctly encode unicode characters (Hebrew)', () => {
        const result = encodeToBase64("שלום");
        expect(result).toBe("16nXnNeV150=");
    });

    it('should correctly encode emojis', () => {
        const result = encodeToBase64("😃");
        expect(result).toBe("8J+Ygw==");
    });
});

describe('decodeBase64ToUtf8', () => {
    it('should correctly decode base64 string to ascii string', () => {
        const result = decodeBase64ToUtf8("aGVsbG8gd29ybGQ=");
        expect(result).toBe("hello world");
    });

    it('should return empty string on error', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const result = decodeBase64ToUtf8("invalid base64...");
        expect(result).toBe("");
        consoleSpy.mockRestore();
    });
});
