import { jest } from '@jest/globals';
import { compressImage } from './admin-gallery.js';

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
