import { decodeBase64ToUtf8 } from './admin-core.js';

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
