import { jest } from '@jest/globals';

// Mock fs to avoid reading actual files and side effects
jest.unstable_mockModule('fs', () => ({
  default: {
    readFileSync: jest.fn(() => '[]'),
    writeFileSync: jest.fn(),
  }
}));

// Mock console.log to suppress output during tests
const originalConsoleLog = console.log;
console.log = jest.fn();

const { generateSlug } = await import('./generate-sitemap.js');

console.log = originalConsoleLog;

describe('generateSlug', () => {
    it('generates a slug for a regular english title', () => {
        expect(generateSlug('Hello World', '2023-10-01')).toBe('2023-10-01-Hello-World');
    });

    it('generates a slug for a hebrew title', () => {
        expect(generateSlug('שלום עולם', '2023-10-01')).toBe('2023-10-01-שלום-עולם');
    });

    it('removes special characters', () => {
        expect(generateSlug('Hello@World!', '2023-10-01')).toBe('2023-10-01-HelloWorld');
    });

    it('handles null title', () => {
        expect(generateSlug(null, '2023-10-01')).toBe('2023-10-01-');
    });

    it('handles undefined title', () => {
        expect(generateSlug(undefined, '2023-10-01')).toBe('2023-10-01-');
    });

    it('handles empty string title', () => {
        expect(generateSlug('', '2023-10-01')).toBe('2023-10-01-');
    });
});
