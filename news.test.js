import { jest } from '@jest/globals';

jest.unstable_mockModule('./data-loader.js', () => ({
    BASE_URL: 'http://localhost',
    allLoadedNews: []
}));

jest.unstable_mockModule('./utils.js', () => ({
    focusLock: jest.fn()
}));

const mockUpdateDynamicMetadata = jest.fn();

describe('closeNewsModal', () => {
    let closeNewsModal;
    let newsModal;
    let originalHistoryPushState;

    beforeAll(async () => {
        // Mock main.js before importing news.js
        jest.unstable_mockModule('./main.js', () => {
            // Need to recreate elements to ensure they exist before import
            const modal = document.createElement('div');
            modal.id = 'news-modal';
            document.body.appendChild(modal);

            return {
                newsModal: modal,
                modalTitle: document.createElement('div'),
                modalDate: document.createElement('div'),
                modalBody: document.createElement('div'),
                newsShareBtn: document.createElement('button'),
                newsPrevBtn: document.createElement('button'),
                newsNextBtn: document.createElement('button'),
                updateDynamicMetadata: mockUpdateDynamicMetadata
            };
        });

        const news = await import('./news.js');
        closeNewsModal = news.closeNewsModal;
        const main = await import('./main.js');
        newsModal = main.newsModal;
    });

    beforeEach(() => {
        document.body.classList.add('no-scroll');
        if (newsModal) {
            newsModal.classList.add('active');
            newsModal.setAttribute('aria-modal', 'true');
        }

        originalHistoryPushState = window.history.pushState;
        window.history.pushState = jest.fn();

        mockUpdateDynamicMetadata.mockClear();
    });

    afterEach(() => {
        window.history.pushState = originalHistoryPushState;
    });

    it('should remove active class from news modal', () => {
        closeNewsModal();
        expect(newsModal.classList.contains('active')).toBe(false);
    });

    it('should remove no-scroll class from body', () => {
        closeNewsModal();
        expect(document.body.classList.contains('no-scroll')).toBe(false);
    });

    it('should remove aria-modal attribute from news modal', () => {
        closeNewsModal();
        expect(newsModal.hasAttribute('aria-modal')).toBe(false);
    });

    it('should reset hash to "#" and update browser history', () => {
        closeNewsModal();
        expect(window.history.pushState).toHaveBeenCalledWith(null, null, '#');
    });

    it('should update dynamic metadata to the default title', () => {
        closeNewsModal();
        expect(mockUpdateDynamicMetadata).toHaveBeenCalledWith('ישיבת בית הלוי - ראש העין');
    });
});
