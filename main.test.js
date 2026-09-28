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

    it('should update description, og and twitter tags when provided', () => {
        const metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        metaDesc.content = 'Old Description';
        document.head.appendChild(metaDesc);

        const ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        ogTitle.content = 'Old OG Title';
        document.head.appendChild(ogTitle);

        const ogDesc = document.createElement('meta');
        ogDesc.setAttribute('property', 'og:description');
        ogDesc.content = 'Old OG Description';
        document.head.appendChild(ogDesc);

        updateDynamicMetadata('New Title', 'New Description');

        expect(document.title).toBe('New Title | ישיבת בית הלוי');
        expect(metaDesc.content).toBe('New Description');
        expect(ogTitle.content).toBe('New Title | ישיבת בית הלוי');
        expect(ogDesc.content).toBe('New Description');

        // Cleanup
        metaDesc.remove();
        ogTitle.remove();
        ogDesc.remove();
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

describe('OneSignal OptOut Fallback', () => {
    let originalConsoleWarn;
    let toastContainer;
    let unsubscribeBtn;

    beforeAll(async () => {
        originalConsoleWarn = console.warn;
        console.warn = jest.fn();

        // Mock OneSignal
        window.oneSignalInitialized = true;
        window.OneSignal = {
            User: {
                PushSubscription: {
                    optOut: jest.fn().mockRejectedValue(new Error('Test OptOut Error'))
                }
            }
        };

        // DOM is mocked in jest.setup.js
        // Import main.js to attach event listeners
        await import('./main.js');
    });

    afterAll(() => {
        console.warn = originalConsoleWarn;
        delete window.oneSignalInitialized;
        delete window.OneSignal;
        jest.restoreAllMocks();
    });

    it('should catch OneSignal optOut error and show toast', async () => {
        unsubscribeBtn = document.getElementById('unsubscribe-btn');
        toastContainer = document.getElementById('toast-container');

        expect(unsubscribeBtn).not.toBeNull();

        // Trigger click
        const clickEvent = new MouseEvent('click', { bubbles: true });
        unsubscribeBtn.dispatchEvent(clickEvent);

        // Wait for microtasks
        await new Promise(resolve => setTimeout(resolve, 0));

        // Check warn was called
        expect(console.warn).toHaveBeenCalledWith("OneSignal optOut error:", expect.any(Error));

        // Check if toast was shown (should not throw and should reach showToast)
        // Check if localStorage was updated
        expect(localStorage.getItem('subscribe_new')).toBe('false');
        expect(localStorage.getItem('subscribe_updates')).toBe('false');

        // Check if toast is rendered
        expect(toastContainer.innerHTML).toContain('קבלת ההתראות בוטלה בהצלחה.');
    });
});
