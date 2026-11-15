import fs from 'fs';
import vm from 'vm';
import { jest } from '@jest/globals';

describe('Service Worker Push Notifications', () => {
    let listeners;
    let mockSelf;

    beforeEach(() => {
        listeners = {};
        mockSelf = {
            addEventListener: jest.fn((event, handler) => {
                listeners[event] = handler;
            }),
            skipWaiting: jest.fn(),
            clients: {
                claim: jest.fn(),
                matchAll: jest.fn().mockResolvedValue([]),
                openWindow: jest.fn()
            },
            registration: {
                showNotification: jest.fn().mockResolvedValue()
            }
        };

        const swCode = fs.readFileSync('./sw.js', 'utf8');
        const context = vm.createContext({
            self: mockSelf,
            caches: {
                open: jest.fn().mockResolvedValue({
                    add: jest.fn().mockResolvedValue(),
                    put: jest.fn().mockResolvedValue()
                }),
                keys: jest.fn().mockResolvedValue([]),
                delete: jest.fn().mockResolvedValue(),
                match: jest.fn().mockResolvedValue()
            },
            fetch: jest.fn(),
            console: { ...console, error: jest.fn(), log: jest.fn(), warn: jest.fn() },
            Promise: Promise,
            Date: Date,
            URL: URL
        });
        vm.runInContext(swCode, context);
    });

    it('should show notification on push event with data', async () => {
        const pushHandler = listeners['push'];
        expect(pushHandler).toBeDefined();

        const mockData = {
            title: 'Test Title',
            body: 'Test Body',
            tag: 'test-tag',
            url: '/test-url',
            notificationId: 'test-id'
        };

        const mockEvent = {
            data: {
                json: jest.fn().mockReturnValue(mockData)
            },
            waitUntil: jest.fn()
        };

        await pushHandler(mockEvent);

        expect(mockEvent.data.json).toHaveBeenCalled();
        expect(mockSelf.registration.showNotification).toHaveBeenCalledWith('Test Title', expect.objectContaining({
            body: 'Test Body',
            tag: 'test-tag',
            data: {
                url: '/test-url',
                id: 'test-id'
            }
        }));
        expect(mockEvent.waitUntil).toHaveBeenCalled();
    });

    it('should use fallback notification when JSON parsing throws', async () => {
        const pushHandler = listeners['push'];

        const mockEvent = {
            data: {
                json: jest.fn().mockImplementation(() => {
                    throw new Error('Invalid JSON');
                })
            },
            waitUntil: jest.fn()
        };

        await pushHandler(mockEvent);

        expect(mockSelf.registration.showNotification).toHaveBeenCalledWith('ישיבת בית הלוי', {
            body: 'יש עדכון חדש בישיבה!',
            icon: './assets/icons/icon-192x192.png'
        });
    });

    it('should use fallback notification when showNotification throws', async () => {
        const pushHandler = listeners['push'];

        mockSelf.registration.showNotification
            .mockImplementationOnce(() => {
                throw new Error('Failed to show notification');
            });

        const mockData = {
            title: 'Test Title'
        };

        const mockEvent = {
            data: {
                json: jest.fn().mockReturnValue(mockData)
            },
            waitUntil: jest.fn()
        };

        await pushHandler(mockEvent);

        expect(mockSelf.registration.showNotification).toHaveBeenCalledTimes(2);

        // Second call should be the fallback
        expect(mockSelf.registration.showNotification).toHaveBeenNthCalledWith(2, 'ישיבת בית הלוי', {
            body: 'יש עדכון חדש בישיבה!',
            icon: './assets/icons/icon-192x192.png'
        });
    });

    it('should handle push event with no data', async () => {
        const pushHandler = listeners['push'];

        const mockEvent = {
            data: null
        };

        await pushHandler(mockEvent);

        expect(mockSelf.registration.showNotification).not.toHaveBeenCalled();
    });
});

describe('Service Worker - Asset Caching Error Paths', () => {
    let listeners;
    let mockSelf;
    let cacheAddMock;
    let consoleWarnSpy;

    beforeEach(() => {
        listeners = {};
        cacheAddMock = jest.fn().mockImplementation((url) => {
            if (url === './index.html') {
                return Promise.reject(new Error('Mock internal cache error'));
            }
            if (url.includes('font-awesome')) {
                return Promise.reject(new Error('Mock external cache error'));
            }
            return Promise.resolve();
        });

        mockSelf = {
            addEventListener: jest.fn((event, handler) => {
                listeners[event] = handler;
            }),
            skipWaiting: jest.fn(),
            clients: {
                claim: jest.fn(),
                matchAll: jest.fn().mockResolvedValue([]),
                openWindow: jest.fn()
            },
            registration: {
                showNotification: jest.fn().mockResolvedValue()
            }
        };

        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const swCode = fs.readFileSync('./sw.js', 'utf8');
        const context = vm.createContext({
            self: mockSelf,
            caches: {
                open: jest.fn().mockResolvedValue({
                    add: cacheAddMock,
                    put: jest.fn().mockResolvedValue()
                }),
                keys: jest.fn().mockResolvedValue([]),
                delete: jest.fn().mockResolvedValue(),
                match: jest.fn().mockResolvedValue()
            },
            fetch: jest.fn(),
            console: { ...console, error: jest.fn(), log: jest.fn(), warn: consoleWarnSpy },
            Promise: Promise,
            Date: Date,
            URL: URL
        });
        vm.runInContext(swCode, context);
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });

    it('should handle asset caching errors during install without failing the overall installation', async () => {
        const installHandler = listeners['install'];
        expect(installHandler).toBeDefined();

        let waitPromise;
        const mockEvent = {
            waitUntil: jest.fn((p) => { waitPromise = p; })
        };

        installHandler(mockEvent);
        expect(mockEvent.waitUntil).toHaveBeenCalled();

        await waitPromise;

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

        expect(cacheAddMock).toHaveBeenCalledWith('./style.css');
        expect(cacheAddMock).toHaveBeenCalledWith('./admin.html');
    });
});
