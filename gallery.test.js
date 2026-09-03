import { jest } from '@jest/globals';

// Setup mock DOM elements before importing the module
const mockGridOverlay = document.createElement('div');
mockGridOverlay.id = 'grid-overlay';

const mockThumbnailGrid = document.createElement('div');
mockThumbnailGrid.id = 'thumbnail-grid';

const mockGridAlbumTitle = document.createElement('div');
mockGridAlbumTitle.id = 'grid-album-title';

const mockLightbox = document.createElement('div');
mockLightbox.id = 'lightbox';

const mockLightboxCloseBtn = document.createElement('button');
mockLightboxCloseBtn.className = 'lightbox-close';

const mockUpdateDynamicMetadata = jest.fn();

// Pre-mock dependencies
jest.unstable_mockModule('./data-loader.js', () => ({
    allLoadedAlbums: []
}));

jest.unstable_mockModule('./utils.js', () => ({
    cleanPath: jest.fn((path) => path.trim()),
    focusLock: jest.fn(),
    normalizeImageUrl: jest.fn((url) => url)
}));

jest.unstable_mockModule('./main.js', () => ({
    gridOverlay: mockGridOverlay,
    thumbnailGrid: mockThumbnailGrid,
    gridAlbumTitle: mockGridAlbumTitle,
    lightbox: mockLightbox,
    lightboxCloseBtn: mockLightboxCloseBtn,
    updateDynamicMetadata: mockUpdateDynamicMetadata,
    albumShareBtn: document.createElement('button'),
    albumDownloadBtn: document.createElement('button'),
    downloadBtn: document.createElement('button'),
    nextBtn: document.createElement('button'),
    prevBtn: document.createElement('button'),
    gridCloseBtn: document.createElement('button'),
    shareBtn: document.createElement('button'),
    lightboxImg: document.createElement('img')
}));

const galleryModule = await import('./gallery.js');

describe('Gallery Tests setup', () => {
    it('is properly imported', () => {
        expect(galleryModule).toBeDefined();
    });
});

describe('openGridOverlay', () => {
    let mockUtils;

    beforeAll(async () => {
        mockUtils = await import('./utils.js');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockThumbnailGrid.textContent = '';
        mockGridAlbumTitle.textContent = '';
        document.body.className = '';
        mockGridOverlay.className = '';
        mockLightbox.className = '';
    });

    it('should correctly set currentAlbumData and DOM elements for an empty album', () => {
        const albumData = {
            title: 'Empty Album',
            slug: 'empty-album',
            images: []
        };

        galleryModule.openGridOverlay(albumData);

        expect(galleryModule.currentAlbumData).toBe(albumData);
        expect(mockGridAlbumTitle.textContent).toBe('Empty Album');
        expect(mockUpdateDynamicMetadata).toHaveBeenCalledWith('גלריה: Empty Album');
        expect(mockThumbnailGrid.textContent).toBe('לא נמצאו תמונות באלבום זה.');
        expect(mockThumbnailGrid.style.color).toBe('white');
        expect(mockThumbnailGrid.style.textAlign).toBe('center');

        expect(mockGridOverlay.classList.contains('active')).toBe(true);
        expect(document.body.classList.contains('no-scroll')).toBe(true);
    });

    it('should process images and set up the grid with skeleton loaders and then thumbnails', () => {
        jest.useFakeTimers();

        const albumData = {
            title: 'Test Album',
            slug: 'test-album',
            images: [' img1.jpg ', 'img2.jpg']
        };

        galleryModule.openGridOverlay(albumData);

        expect(galleryModule.currentAlbumImages).toHaveLength(2);
        expect(galleryModule.currentAlbumImages[0]).toEqual({
            src: 'img1.jpg',
            alt: 'Test Album - תמונה 1',
            albumSlug: 'test-album'
        });

        // Verify cleanPath was called
        expect(mockUtils.cleanPath).toHaveBeenCalledWith(' img1.jpg ');

        // Check skeleton loader
        expect(mockThumbnailGrid.children.length).toBe(12);
        expect(mockThumbnailGrid.children[0].className).toBe('loading-thumbnail');

        // Advance timers by 300ms to trigger thumbnail rendering
        jest.advanceTimersByTime(300);

        // Verify thumbnails are added
        expect(mockThumbnailGrid.children.length).toBe(2);
        expect(mockThumbnailGrid.children[0].tagName).toBe('IMG');
        expect(mockThumbnailGrid.children[0].src).toContain('img1.jpg');
        expect(mockThumbnailGrid.children[0].className).toBe('lazy-load');

        // Advance timers to trigger visibility class
        jest.advanceTimersByTime(50); // index 0 * 50 = 0 (runs immediately but we tick)
        jest.advanceTimersByTime(50); // index 1 * 50 = 50

        expect(mockThumbnailGrid.children[0].classList.contains('visible')).toBe(true);
        expect(mockThumbnailGrid.children[1].classList.contains('visible')).toBe(true);

        jest.useRealTimers();
    });

    it('should open lightbox when a thumbnail is clicked', () => {
        jest.useFakeTimers();

        // Mock showLightboxImage as it contains complex UI logic not relevant to this test
        // Since showLightboxImage is called internally and we cannot mock it easily,
        // we can spy on lightbox elements directly.
        const albumData = {
            title: 'Test Album',
            slug: 'test-album',
            images: ['img1.jpg']
        };

        galleryModule.openGridOverlay(albumData);
        jest.advanceTimersByTime(300); // Trigger thumbnail render

        const thumb = mockThumbnailGrid.children[0];
        thumb.click();

        expect(galleryModule.currentIndex).toBe(0);
        expect(mockGridOverlay.classList.contains('active')).toBe(true);
        expect(mockLightbox.classList.contains('active')).toBe(true);
        expect(mockLightbox.getAttribute('aria-modal')).toBe('true');
        expect(mockUtils.focusLock).toHaveBeenCalledWith(mockLightbox, mockLightboxCloseBtn);
        jest.useRealTimers();
    });
});
