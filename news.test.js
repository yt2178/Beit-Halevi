import { jest } from '@jest/globals';

let newsModule;
let mockUpdateDynamicMetadata;
let mockNewsModal;
let mockNewsShareBtn;

describe('news.js', () => {

    beforeAll(async () => {
        mockUpdateDynamicMetadata = jest.fn();

        mockNewsModal = document.createElement('div');
        mockNewsModal.id = 'news-modal';
        mockNewsModal.appendChild(document.createElement('button')).className = 'modal-close';
        mockNewsShareBtn = document.createElement('button');

        global.marked = { parse: jest.fn(str => str) };
        global.DOMPurify = { sanitize: jest.fn(str => str) };
        global.alert = jest.fn();

        jest.unstable_mockModule('./main.js', () => ({
            newsModal: mockNewsModal,
            modalTitle: document.createElement('div'),
            modalDate: document.createElement('div'),
            modalBody: document.createElement('div'),
            newsShareBtn: mockNewsShareBtn,
            newsWhatsappBtn: document.createElement('button'),
            newsPrevBtn: document.createElement('button'),
            newsNextBtn: document.createElement('button'),
            updateDynamicMetadata: mockUpdateDynamicMetadata
        }));

        jest.unstable_mockModule('./data-loader.js', () => ({
            BASE_URL: 'http://localhost',
            allLoadedNews: []
        }));

        jest.unstable_mockModule('./utils.js', () => ({
            focusLock: jest.fn()
        }));

        newsModule = await import('./news.js');
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup initial state for tests
        mockNewsModal.classList.add('active');
        mockNewsModal.setAttribute('aria-modal', 'true');
        document.body.classList.add('no-scroll');

        // Mock window.history.pushState
        window.history.pushState = jest.fn();
    });

    it('should close the news modal by removing active class and aria-modal attribute', () => {
        newsModule.closeNewsModal();

        expect(mockNewsModal.classList.contains('active')).toBe(false);
        expect(mockNewsModal.hasAttribute('aria-modal')).toBe(false);
    });

    it('should remove no-scroll class from document.body', () => {
        newsModule.closeNewsModal();

        expect(document.body.classList.contains('no-scroll')).toBe(false);
    });

    it('should reset window.history hash to "#"', () => {
        newsModule.closeNewsModal();

        expect(window.history.pushState).toHaveBeenCalledWith(null, null, '#');
    });

    it('should call updateDynamicMetadata with default title', () => {
        newsModule.closeNewsModal();

        expect(mockUpdateDynamicMetadata).toHaveBeenCalledWith('ישיבת בית הלוי - ראש העין');
    });

    describe('openNewsModal share fallback', () => {
        const dummyNewsItem = {
            slug: 'test-item',
            title: 'Test News Title',
            date: '2023-01-01',
            body: 'Test Body'
        };

        it('should copy link to clipboard when navigator.share is unsupported', async () => {
            const originalShare = navigator.share;
            delete navigator.share;

            const writeTextMock = jest.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: writeTextMock },
                configurable: true,
                writable: true
            });

            newsModule.openNewsModal(dummyNewsItem);
            await mockNewsShareBtn.onclick();

            expect(writeTextMock).toHaveBeenCalled();
            expect(global.alert).toHaveBeenCalledWith('הקישור הועתק ללוח!');

            if (originalShare) navigator.share = originalShare;
        });

        it('should silently handle clipboard write failure when navigator.share is unsupported', async () => {
            const originalShare = navigator.share;
            delete navigator.share;

            const writeTextMock = jest.fn().mockRejectedValue(new Error('Clipboard error'));
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: writeTextMock },
                configurable: true,
                writable: true
            });

            newsModule.openNewsModal(dummyNewsItem);
            await expect(mockNewsShareBtn.onclick()).resolves.not.toThrow();

            expect(writeTextMock).toHaveBeenCalled();

            if (originalShare) navigator.share = originalShare;
        });
    });
});
