import { jest } from '@jest/globals';

// Set up globals before importing any module
document.body.innerHTML = `
    <div id="about-title-dynamic"></div>
    <div id="about-body-dynamic"></div>
    <div id="donation-title-dynamic"></div>
    <div id="donation-body-dynamic"></div>
    <a id="donation-link-dynamic"></a>
    <div id="date-time-display"></div>
    <div id="hebrew-year-display"></div>
    <button id="theme-toggle"></button>
    <form id="contact-form"></form>
    <button id="back-to-top-btn"></button>
    <div id="grid-overlay"></div>
    <div id="lightbox">
        <button class="lightbox-close"></button>
        <button class="lightbox-next"></button>
        <button class="lightbox-prev"></button>
    </div>
    <button id="download-btn"></button>
    <button class="grid-close"></button>
    <div id="thumbnail-grid"></div>
    <div id="grid-album-title"></div>
    <img id="lightbox-img"></img>
    <button id="share-btn"></button>
    <button id="album-share-btn"></button>
    <button id="album-download-btn"></button>
    <div id="news-modal">
        <button class="modal-close"></button>
    </div>
    <div id="modal-title"></div>
    <div id="modal-date"></div>
    <div id="modal-body"></div>
    <button id="news-share-btn"></button>
    <button id="news-prev-btn"></button>
    <button id="news-next-btn"></button>
    <button class="menu-toggle"></button>
    <div class="nav-links"></div>
    <div id="news-container"></div>
`;

describe('applySiteConfig', () => {
    let dataLoader;
    let applySiteConfig;
    let utils;

    beforeAll(async () => {
        // Mock dependencies
        jest.unstable_mockModule('./utils.js', () => ({
            fetchStaticJson: jest.fn(),
            cleanPath: jest.fn(),
            parseFrontMatter: jest.fn(),
            focusLock: jest.fn(),
            getHebrewYear: jest.fn()
        }));

        jest.unstable_mockModule('./gallery.js', () => ({
            openGridOverlay: jest.fn(),
            checkUrlHash: jest.fn()
        }));

        jest.unstable_mockModule('./news.js', () => ({
            openNewsModal: jest.fn(),
            checkNewsHash: jest.fn()
        }));

        dataLoader = await import('./data-loader.js');
        applySiteConfig = dataLoader.applySiteConfig;
        utils = await import('./utils.js');
    });

    beforeEach(() => {
        document.getElementById('about-title-dynamic').textContent = '';
        document.getElementById('about-body-dynamic').textContent = '';
        document.getElementById('donation-title-dynamic').textContent = '';
        document.getElementById('donation-body-dynamic').textContent = '';
        document.getElementById('donation-link-dynamic').href = '';
        document.documentElement.style.setProperty('--primary-color', '');

        jest.clearAllMocks();
        dataLoader.fetchCache.clear();
    });

    it('should fetch and apply config properly', async () => {
        const mockConfig = {
            texts: {
                about_title: 'Test About Title',
                about_body: 'Test About Body',
                donation_title: 'Test Donation Title',
                donation_body: 'Test Donation Body',
                donation_link: 'http://test.com/donate'
            },
            primaryColor: '#ff0000'
        };

        utils.fetchStaticJson.mockResolvedValue(mockConfig);

        await applySiteConfig();

        expect(utils.fetchStaticJson).toHaveBeenCalledWith('site-config');

        expect(document.getElementById('about-title-dynamic').textContent).toBe('Test About Title');
        expect(document.getElementById('about-body-dynamic').textContent).toBe('Test About Body');
        expect(document.getElementById('donation-title-dynamic').textContent).toBe('Test Donation Title');
        expect(document.getElementById('donation-body-dynamic').textContent).toBe('Test Donation Body');
        expect(document.getElementById('donation-link-dynamic').href).toBe('http://test.com/donate');

        expect(document.documentElement.style.getPropertyValue('--primary-color')).toBe('#ff0000');
    });

    it('should handle missing config properties gracefully', async () => {
        const mockConfig = {
            texts: {
                about_title: 'Test About Title'
            }
        };
        utils.fetchStaticJson.mockResolvedValue(mockConfig);

        await applySiteConfig();

        expect(document.getElementById('about-title-dynamic').textContent).toBe('Test About Title');
        expect(document.getElementById('about-body-dynamic').textContent).toBe('');
    });

    it('should handle fetch failure', async () => {
        utils.fetchStaticJson.mockRejectedValue(new Error('Fetch failed'));
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await applySiteConfig();

        expect(consoleSpy).toHaveBeenCalledWith('Failed to apply site config', expect.any(Error));
        expect(document.getElementById('about-title-dynamic').textContent).toBe('');

        consoleSpy.mockRestore();
    });

    it('should do nothing if config has error property', async () => {
        utils.fetchStaticJson.mockResolvedValue({ error: true });

        await applySiteConfig();

        expect(document.getElementById('about-title-dynamic').textContent).toBe('');
    });

    it('should do nothing if config is null', async () => {
        utils.fetchStaticJson.mockResolvedValue(null);

        await applySiteConfig();

        expect(document.getElementById('about-title-dynamic').textContent).toBe('');
    });
});

describe('loadNews', () => {
    let dataLoader;
    let loadNews;
    let utils;

    beforeAll(async () => {
        dataLoader = await import('./data-loader.js');
        loadNews = dataLoader.loadNews;
        utils = await import('./utils.js');
    });

    beforeEach(() => {
        document.getElementById('news-container').innerHTML = '';
        jest.clearAllMocks();
        dataLoader.fetchCache.clear();
    });

    it('should display an error message if response is null', async () => {
        utils.fetchStaticJson.mockResolvedValue(null);

        await loadNews();

        const newsContainer = document.getElementById('news-container');
        const p = newsContainer.querySelector('p');

        expect(p).not.toBeNull();
        expect(p.style.color).toBe('red');
        expect(p.textContent).toBe('שגיאה בטעינת העדכונים. ודא שקובץ data/news.json קיים.');
    });

    it('should display an error message if response has an error', async () => {
        const errorMessage = 'Custom error message';
        utils.fetchStaticJson.mockResolvedValue({ error: true, message: errorMessage });

        await loadNews();

        const newsContainer = document.getElementById('news-container');
        const p = newsContainer.querySelector('p');

        expect(p).not.toBeNull();
        expect(p.style.color).toBe('red');
        expect(p.textContent).toBe(errorMessage);
    });
});
