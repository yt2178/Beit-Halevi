import { jest } from '@jest/globals';

describe('Service Worker - Asset Caching Error Paths', () => {
    let addEventListenerMock;
    let waitUntilMock;
    let skipWaitingMock;
    let cacheOpenMock;
    let cacheAddMock;
    let consoleWarnSpy;

    beforeEach(async () => {
        jest.resetModules();
        addEventListenerMock = jest.fn();
        waitUntilMock = jest.fn((promise) => promise);
        skipWaitingMock = jest.fn();

        cacheAddMock = jest.fn();
        cacheOpenMock = jest.fn().mockResolvedValue({
            add: cacheAddMock
        });

        global.self = {
            addEventListener: addEventListenerMock,
            skipWaiting: skipWaitingMock,
            clients: { claim: jest.fn() },
            registration: { showNotification: jest.fn() }
        };
        global.caches = {
            open: cacheOpenMock,
            keys: jest.fn().mockResolvedValue([]),
            match: jest.fn()
        };

        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Import service worker with cache busting to re-execute for each test
        await import('./sw.js?t=' + Date.now());
    });

    afterEach(() => {
        delete global.self;
        delete global.caches;
        consoleWarnSpy.mockRestore();
    });

    it('should handle asset caching errors during install without failing the overall installation', async () => {
        // Set up mock to fail on specific URLs
        cacheAddMock.mockImplementation((url) => {
            if (url === './index.html') {
                return Promise.reject(new Error('Mock internal cache error'));
            }
            if (url.includes('font-awesome')) {
                return Promise.reject(new Error('Mock external cache error'));
            }
            return Promise.resolve();
        });

        // Find the install event listener
        const installCall = addEventListenerMock.mock.calls.find(call => call[0] === 'install');
        expect(installCall).toBeDefined();

        const installHandler = installCall[1];

        const event = {
            waitUntil: waitUntilMock
        };

        // Trigger install
        installHandler(event);

        // Ensure wait until was called
        expect(waitUntilMock).toHaveBeenCalled();

        // Wait for all promises passed to waitUntil to resolve
        await waitUntilMock.mock.calls[0][0];

        // Ensure console.warn was called for both internal and external assets
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            "Failed to cache internal asset:",
            "./index.html",
            expect.any(Error)
        );

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            "Failed to cache external asset:",
            "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css",
            expect.any(Error)
        );

        // Ensure other assets were still cached successfully
        expect(cacheAddMock).toHaveBeenCalledWith('./style.css');
        expect(cacheAddMock).toHaveBeenCalledWith('./admin.html');
    });
});
