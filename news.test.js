import { jest } from '@jest/globals';

let newsModule;
let mockUpdateDynamicMetadata;
let mockNewsModal;

describe('closeNewsModal', () => {

    beforeAll(async () => {
        mockUpdateDynamicMetadata = jest.fn();

        mockNewsModal = document.createElement('div');
        mockNewsModal.id = 'news-modal';

        jest.unstable_mockModule('./main.js', () => ({
            newsModal: mockNewsModal,
            modalTitle: document.createElement('div'),
            modalDate: document.createElement('div'),
            modalBody: document.createElement('div'),
            newsShareBtn: document.createElement('button'),
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
});
