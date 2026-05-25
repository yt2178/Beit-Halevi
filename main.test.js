import { jest } from '@jest/globals';
import { updateDynamicMetadata } from './main.js';

describe('updateDynamicMetadata', () => {
    let originalTitle;

    beforeEach(() => {
        originalTitle = document.title;
    });

    afterEach(() => {
        document.title = originalTitle;
    });

    it('should update document.title when title is provided', () => {
        const testTitle = 'Test Title';
        updateDynamicMetadata(testTitle, 'Test Description');
        expect(document.title).toBe(`${testTitle} | ישיבת בית הלוי`);
    });

    it('should not update document.title when title is not provided', () => {
        document.title = 'Original Title';
        updateDynamicMetadata(null, 'Test Description');
        expect(document.title).toBe('Original Title');
    });

    it('should handle undefined title', () => {
        document.title = 'Original Title';
        updateDynamicMetadata(undefined, 'Test Description');
        expect(document.title).toBe('Original Title');
    });

    it('should handle empty string title', () => {
        document.title = 'Original Title';
        updateDynamicMetadata('', 'Test Description');
        expect(document.title).toBe('Original Title');
    });
});
