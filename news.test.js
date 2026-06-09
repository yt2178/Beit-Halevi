import { jest } from '@jest/globals';

describe('news.js checkNewsHash', () => {
    let checkNewsHash;

    beforeAll(async () => {
        // Mock data-loader dependencies before importing news.js
        jest.unstable_mockModule('./data-loader.js', () => ({
            BASE_URL: 'mock_base_url',
            allLoadedNews: []
        }));
        jest.unstable_mockModule('./utils.js', () => ({
            focusLock: jest.fn()
        }));
        jest.unstable_mockModule('./main.js', () => ({
            newsModal: document.createElement('div'),
            modalTitle: document.createElement('div'),
            modalDate: document.createElement('div'),
            modalBody: document.createElement('div'),
            newsShareBtn: document.createElement('button'),
            newsPrevBtn: document.createElement('button'),
            newsNextBtn: document.createElement('button'),
            updateDynamicMetadata: jest.fn()
        }));

        const newsModule = await import('./news.js');
        checkNewsHash = newsModule.checkNewsHash;
    });

    it('should catch URI malformed error on decodeURIComponent', () => {
        // Set hash to an invalid URI component
        window.location.hash = '#news/%E0%A4%A';

        // Mock console.error
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        checkNewsHash();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "Failed to decode news slug",
            expect.any(URIError)
        );

        consoleErrorSpy.mockRestore();
    });
});
