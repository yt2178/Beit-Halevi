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
