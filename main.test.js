import { jest } from '@jest/globals';
import { updateDynamicMetadata, updateAppBadge } from './main.js';

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

describe('updateAppBadge', () => {
    let originalNavigator;

    beforeAll(() => {
        originalNavigator = global.navigator;
    });

    afterAll(() => {
        global.navigator = originalNavigator;
    });

    beforeEach(() => {
        global.navigator = { ...originalNavigator };
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should do nothing if setAppBadge is not in navigator', () => {
        delete global.navigator.setAppBadge;
        expect(() => updateAppBadge(5)).not.toThrow();
    });

    test('should call navigator.setAppBadge with count if count > 0', () => {
        const mockSetAppBadge = jest.fn().mockResolvedValue();
        global.navigator.setAppBadge = mockSetAppBadge;

        updateAppBadge(5);

        expect(mockSetAppBadge).toHaveBeenCalledWith(5);
    });

    test('should call navigator.clearAppBadge if count is 0', () => {
        const mockSetAppBadge = jest.fn().mockResolvedValue();
        const mockClearAppBadge = jest.fn().mockResolvedValue();
        global.navigator.setAppBadge = mockSetAppBadge;
        global.navigator.clearAppBadge = mockClearAppBadge;

        updateAppBadge(0);

        expect(mockClearAppBadge).toHaveBeenCalled();
        expect(mockSetAppBadge).not.toHaveBeenCalled();
    });

    test('should call navigator.clearAppBadge if count is less than 0', () => {
        const mockSetAppBadge = jest.fn().mockResolvedValue();
        const mockClearAppBadge = jest.fn().mockResolvedValue();
        global.navigator.setAppBadge = mockSetAppBadge;
        global.navigator.clearAppBadge = mockClearAppBadge;

        updateAppBadge(-1);

        expect(mockClearAppBadge).toHaveBeenCalled();
        expect(mockSetAppBadge).not.toHaveBeenCalled();
    });
});
