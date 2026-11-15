import { jest } from '@jest/globals';
import { updateGithubAuth, encodeToBase64 } from './admin-core.js';
import { compressImage, loadAndRenderGallery, initGalleryAdminEvents, resetGalleryForm } from './admin-gallery.js';

describe('compressImage', () => {
    let originalFileReader;
    let originalImage;
    let mockDrawImage;
    let mockContext;
    let originalCreateElement;

    beforeEach(() => {
        mockDrawImage = jest.fn();
        mockContext = { drawImage: mockDrawImage };

        originalCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
            if (tagName.toLowerCase() === 'canvas') {
                return {
                    width: 0,
                    height: 0,
                    getContext: jest.fn().mockReturnValue(mockContext),
                    toBlob: jest.fn((callback, mimeType, quality) => {
                        const dummyBlob = new Blob(['mock-data'], { type: mimeType });
                        callback(dummyBlob);
                    })
                };
            }
            return originalCreateElement(tagName);
        });

        // Mock FileReader
        originalFileReader = global.FileReader;
        global.FileReader = jest.fn().mockImplementation(() => {
            const reader = {
                readAsDataURL: jest.fn(function() {
                    queueMicrotask(() => {
                        if (reader.shouldFail) {
                            if (reader.onerror) reader.onerror(reader.errorToThrow || new Error('FileReader read error'));
                        } else if (reader.onload) {
                            reader.onload({ target: { result: 'data:image/png;base64,mockdata' } });
                        }
                    });
                }),
                onload: null,
                onerror: null,
                shouldFail: false,
                errorToThrow: null
            };
            return reader;
        });

        // Mock Image
        originalImage = global.Image;
        global.Image = jest.fn().mockImplementation(() => {
            const img = {
                width: 2000,
                height: 1000,
                _src: '',
                get src() { return this._src; },
                set src(value) {
                    this._src = value;
                    queueMicrotask(() => {
                        if (img.shouldFail) {
                            if (img.onerror) img.onerror(img.errorToThrow || new Error('Image decode error'));
                        } else if (img.onload) {
                            img.onload();
                        }
                    });
                },
                onload: null,
                onerror: null,
                shouldFail: false,
                errorToThrow: null
            };
            return img;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        global.FileReader = originalFileReader;
        global.Image = originalImage;
    });

    it('should scale image dimensions when width > maxWidth', async () => {
        const file = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
        const compressedFile = await compressImage(file, 1600, 0.8);

        expect(compressedFile).toBeInstanceOf(File);
        expect(compressedFile.name).toBe('photo.webp');
        expect(compressedFile.type).toBe('image/webp');
        expect(mockDrawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 800);
    });

    it('should maintain original image dimensions when width <= maxWidth', async () => {
        global.Image = jest.fn().mockImplementation(() => {
            const img = {
                width: 1000,
                height: 500,
                _src: '',
                get src() { return this._src; },
                set src(value) {
                    this._src = value;
                    queueMicrotask(() => {
                        if (img.onload) img.onload();
                    });
                },
                onload: null,
                onerror: null
            };
            return img;
        });

        const file = new File(['dummy'], 'small-photo.png', { type: 'image/png' });
        const compressedFile = await compressImage(file, 1600, 0.8);

        expect(compressedFile.name).toBe('small-photo.webp');
        expect(mockDrawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1000, 500);
    });

    it('should respect custom maxWidth and quality options', async () => {
        let capturedQuality = null;
        let capturedMime = null;

        jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
            if (tagName.toLowerCase() === 'canvas') {
                return {
                    width: 0,
                    height: 0,
                    getContext: jest.fn().mockReturnValue(mockContext),
                    toBlob: jest.fn((callback, mimeType, quality) => {
                        capturedMime = mimeType;
                        capturedQuality = quality;
                        callback(new Blob(['mock'], { type: mimeType }));
                    })
                };
            }
            return originalCreateElement(tagName);
        });

        const file = new File(['dummy'], 'custom.jpg', { type: 'image/jpeg' });
        await compressImage(file, 800, 0.5);

        expect(mockDrawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 400);
        expect(capturedMime).toBe('image/webp');
        expect(capturedQuality).toBe(0.5);
    });

    it('should handle filenames without an extension correctly', async () => {
        const file = new File(['dummy'], 'noextension', { type: 'image/jpeg' });
        const compressedFile = await compressImage(file);

        expect(compressedFile.name).toBe('noextension.webp');
    });

    it('should handle filenames with multiple dots correctly', async () => {
        const file = new File(['dummy'], 'my.photo.archive.png', { type: 'image/png' });
        const compressedFile = await compressImage(file);

        expect(compressedFile.name).toBe('my.photo.archive.webp');
    });

    it('should reject with an error when canvas.toBlob returns null', async () => {
        jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
            if (tagName.toLowerCase() === 'canvas') {
                return {
                    width: 0,
                    height: 0,
                    getContext: jest.fn().mockReturnValue(mockContext),
                    toBlob: jest.fn((callback) => callback(null))
                };
            }
            return originalCreateElement(tagName);
        });

        const file = new File(['dummy'], 'fail.jpg', { type: 'image/jpeg' });
        await expect(compressImage(file)).rejects.toThrow('Canvas toBlob failed');
    });

    it('should reject when FileReader encounters an error', async () => {
        global.FileReader = jest.fn().mockImplementation(() => {
            const reader = {
                readAsDataURL: jest.fn(function() {
                    queueMicrotask(() => {
                        if (reader.onerror) reader.onerror(new Error('FileReader read error'));
                    });
                }),
                onload: null,
                onerror: null
            };
            return reader;
        });

        const file = new File(['dummy'], 'error.jpg', { type: 'image/jpeg' });
        await expect(compressImage(file)).rejects.toThrow('FileReader read error');
    });

    it('should reject when Image loading fails', async () => {
        global.Image = jest.fn().mockImplementation(() => {
            const img = {
                width: 2000,
                height: 1000,
                _src: '',
                get src() { return this._src; },
                set src(value) {
                    this._src = value;
                    queueMicrotask(() => {
                        if (img.onerror) img.onerror(new Error('Image decode error'));
                    });
                },
                onload: null,
                onerror: null
            };
            return img;
        });

        const file = new File(['dummy'], 'error.jpg', { type: 'image/jpeg' });
        await expect(compressImage(file)).rejects.toThrow('Image decode error');
    });
});


describe('admin-gallery.js', () => {
    let mockFetch;
    let mockConfirm;

    beforeEach(() => {
        // Set up required DOM elements
        document.body.innerHTML = `
            <div id="status-overlay" style="display:none;">
                <div id="status-text"></div>
                <div id="status-progress-container"><div id="status-progress"></div></div>
                <button id="close-status-btn"></button>
            </div>
            <form id="add-album-form">
                <input id="albumTitleInput" value="" />
                <input id="albumDateInput" value="" />
                <input id="albumThumbnailUrl" value="" />
                <input type="file" id="albumImagesInput" />
                <div id="albumPreview" class="album-preview-grid"></div>
                <button type="submit">שמור אלבום</button>
                <button type="button" id="cancel-album-edit" style="display:none;">ביטול</button>
            </form>
            <div id="gallery-status-message"></div>
            <div id="gallery-list-container"></div>
            <div id="image-preview-modal" style="display:none;">
                <button id="close-preview-modal"></button>
                <button id="modal-prev-btn"></button>
                <button id="modal-next-btn"></button>
                <img id="preview-large-img" src="" />
            </div>
        `;

        // Set valid GITHUB_TOKEN
        updateGithubAuth('mock-github-token', 'test-user');

        // Mock window.fetch
        mockFetch = jest.spyOn(window, 'fetch').mockImplementation(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    sha: 'test-sha-123',
                    content: encodeToBase64(JSON.stringify([]))
                }),
                text: () => Promise.resolve('')
            })
        );

        mockConfirm = jest.spyOn(window, 'confirm').mockImplementation(() => true);

        // Fire DOMContentLoaded event to ensure internal variable references in admin-gallery.js are set
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        updateGithubAuth(null, null);
    });

    describe('loadAndRenderGallery', () => {
        it('should return early without fetching if GITHUB_TOKEN is not set', async () => {
            updateGithubAuth(null, null);
            await loadAndRenderGallery();
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should show error status if fetch response is not ok', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: () => Promise.resolve('Not Found')
            });

            await loadAndRenderGallery();

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const statusText = document.getElementById('status-text');
            expect(statusText.textContent).toBe('שגיאה בטעינת הגלריה');
        });

        it('should show empty state when gallery array is empty', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    sha: 'sha-empty',
                    content: encodeToBase64(JSON.stringify([]))
                })
            });

            await loadAndRenderGallery();

            const container = document.getElementById('gallery-list-container');
            expect(container.querySelector('.empty-state')).not.toBeNull();
            expect(container.textContent).toContain('אין אלבומים להצגה');
        });

        it('should render albums list when gallery array contains albums', async () => {
            const albums = [
                {
                    data: {
                        title: 'אלבום ראשון',
                        date: '2023-05-10',
                        thumbnail: 'https://example.com/thumb1.jpg',
                        images: ['https://example.com/thumb1.jpg', 'https://example.com/img2.jpg']
                    }
                }
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    sha: 'sha-album-1',
                    content: encodeToBase64(JSON.stringify(albums))
                })
            });

            await loadAndRenderGallery();

            const container = document.getElementById('gallery-list-container');
            expect(container.dataset.sha).toBe('sha-album-1');
            const item = container.querySelector('.album-item-admin');
            expect(item).not.toBeNull();
            expect(item.querySelector('h3').textContent).toBe('אלבום ראשון');
            expect(item.querySelector('p').textContent).toBe('2 תמונות | תאריך: 2023-05-10');
            expect(item.querySelector('.edit-album-btn')).not.toBeNull();
            expect(item.querySelector('.delete-album-btn')).not.toBeNull();
        });

        it('should allow editing an album when clicking edit button', async () => {
            const albums = [
                {
                    data: {
                        title: 'אלבום לעריכה',
                        date: '2023-06-01',
                        thumbnail: 'https://example.com/thumb.jpg',
                        images: ['https://example.com/thumb.jpg']
                    }
                }
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    sha: 'sha-edit',
                    content: encodeToBase64(JSON.stringify(albums))
                })
            });

            await loadAndRenderGallery();

            const editBtn = document.querySelector('.edit-album-btn');
            window.HTMLElement.prototype.scrollIntoView = jest.fn();
            editBtn.click();

            expect(document.getElementById('albumTitleInput').value).toBe('אלבום לעריכה');
            expect(document.getElementById('albumDateInput').value).toBe('2023-06-01');
            expect(document.getElementById('albumThumbnailUrl').value).toBe('https://example.com/thumb.jpg');
            expect(document.querySelector('button[type="submit"]').textContent).toBe('עדכן אלבום');
            expect(document.getElementById('cancel-album-edit').style.display).toBe('inline-block');
        });

        it('should delete album when delete button is clicked and confirmed', async () => {
            const albums = [
                {
                    data: {
                        title: 'אלבום למחיקה',
                        date: '2023-07-01',
                        thumbnail: 'https://example.com/thumb.jpg',
                        images: ['https://example.com/thumb.jpg']
                    }
                }
            ];

            // 1. Initial loadAndRenderGallery fetch
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    sha: 'sha-del',
                    content: encodeToBase64(JSON.stringify(albums))
                })
            });

            await loadAndRenderGallery();

            // 2. Mock fetch for deleteAlbum (GET latest file, then PUT) and subsequent reload GET
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        sha: 'sha-del',
                        content: encodeToBase64(JSON.stringify(albums))
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ content: { sha: 'sha-updated' } })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        sha: 'sha-updated',
                        content: encodeToBase64(JSON.stringify([]))
                    })
                });

            const deleteBtn = document.querySelector('.delete-album-btn');
            deleteBtn.click();

            // Wait for async delete logic
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockConfirm).toHaveBeenCalledWith('האם אתה בטוח שברצונך למחוק את האלבום?');
            expect(document.getElementById('gallery-status-message').textContent).toBe('האלבום נמחק בהצלחה');
        });
    });

    describe('initGalleryAdminEvents', () => {
        it('should initialize albumDateInput to current date if empty', () => {
            const dateInput = document.getElementById('albumDateInput');
            dateInput.value = '';

            initGalleryAdminEvents();

            const todayStr = new Date().toISOString().split('T')[0];
            expect(dateInput.value).toBe(todayStr);
        });

        it('should setup preview modal close button listener', () => {
            initGalleryAdminEvents();

            const modal = document.getElementById('image-preview-modal');
            const closeBtn = document.getElementById('close-preview-modal');
            modal.style.display = 'flex';

            closeBtn.click();

            expect(modal.style.display).toBe('none');
        });

        it('should handle keyboard events for modal navigation and escape key', () => {
            initGalleryAdminEvents();

            const modal = document.getElementById('image-preview-modal');
            modal.style.display = 'flex';

            // Escape key closes modal
            const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(escEvent);

            expect(modal.style.display).toBe('none');
        });
    });

    describe('resetGalleryForm', () => {
        it('should reset form, preview, and state', () => {
            const form = document.getElementById('add-album-form');
            const albumTitleInput = document.getElementById('albumTitleInput');
            const albumPreview = document.getElementById('albumPreview');
            const cancelBtn = document.getElementById('cancel-album-edit');
            const submitBtn = form.querySelector('button[type="submit"]');

            albumTitleInput.value = 'כותרת זמנית';
            albumPreview.appendChild(document.createElement('div'));
            cancelBtn.style.display = 'inline-block';
            submitBtn.textContent = 'עדכן אלבום';

            resetGalleryForm();

            expect(albumTitleInput.value).toBe('');
            expect(albumPreview.children.length).toBe(0);
            expect(submitBtn.textContent).toBe('שמור אלבום');
            expect(cancelBtn.style.display).toBe('none');
            expect(document.getElementById('albumDateInput').value).toBe(new Date().toISOString().split('T')[0]);
        });
    });
});

