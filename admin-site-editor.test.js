import { jest } from '@jest/globals';
import { encodeToBase64 } from './admin-core.js';

describe('admin-site-editor', () => {
    let loadSiteConfig;
    let saveAllSiteSettings;
    let pingIndexNow;

    beforeEach(() => {
        document.body.innerHTML = `
            <input id="site-donation-link" value="" />
            <select id="site-theme-select">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
            </select>
            <input id="site-primary-color" value="#1a4b84" />
            <input id="site-onesignal-id" value="" />
            <input id="site-onesignal-rest" value="" />
            <button id="save-onesignal-btn"></button>
            <div id="editable-texts-list"></div>
            <div id="site-preview-container"></div>
            <div id="text-edit-area" style="display:none"></div>
            <span id="editing-label"></span>
            <textarea id="site-text-editor"></textarea>
            <button id="save-site-text"></button>
            <span id="indexnow-status"></span>
            <button id="ping-indexnow-btn"></button>
            <div id="status-message"></div>
        `;

        sessionStorage.clear();
        localStorage.clear();
    });

    beforeAll(async () => {
        const module = await import('./admin-site-editor.js');
        loadSiteConfig = module.loadSiteConfig;
        saveAllSiteSettings = module.saveAllSiteSettings;
        pingIndexNow = module.pingIndexNow;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('loadSiteConfig', () => {
        it('should load site config successfully when fetch response is ok', async () => {
            const mockConfig = {
                texts: {
                    about_title: 'אודות העמותה',
                    donation_link: 'https://example.com/donate'
                },
                theme: 'dark',
                primaryColor: '#2c3e50'
            };

            const encodedContent = encodeToBase64(JSON.stringify(mockConfig));

            jest.spyOn(window, 'fetch').mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    content: encodedContent,
                    sha: 'sha-123'
                })
            });

            const config = await loadSiteConfig();

            expect(config.theme).toBe('dark');
            expect(config.primaryColor).toBe('#2c3e50');
            expect(document.getElementById('site-theme-select').value).toBe('dark');
            expect(document.getElementById('site-primary-color').value).toBe('#2c3e50');
            expect(document.getElementById('site-donation-link').value).toBe('https://example.com/donate');
        });

        it('should return default config when fetch returns non-ok response', async () => {
            jest.spyOn(window, 'fetch').mockResolvedValueOnce({
                ok: false,
                status: 404
            });

            const config = await loadSiteConfig();

            expect(config).toEqual({
                texts: {},
                theme: 'light',
                primaryColor: '#1a4b84'
            });
            expect(document.getElementById('editable-texts-list').children.length).toBeGreaterThan(0);
        });

        it('should log error and return default config when fetch throws an error', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            jest.spyOn(window, 'fetch').mockRejectedValueOnce(new Error('Network error'));

            const config = await loadSiteConfig();

            expect(consoleSpy).toHaveBeenCalledWith('Error loading site config:', expect.any(Error));
            expect(config).toEqual({
                texts: {},
                theme: 'light',
                primaryColor: '#1a4b84'
            });
        });

        it('should log error and return default config when JSON parsing fails', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            jest.spyOn(window, 'fetch').mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    content: encodeToBase64('invalid json {')
                })
            });

            const config = await loadSiteConfig();

            expect(consoleSpy).toHaveBeenCalledWith('Error loading site config:', expect.any(Error));
            expect(config).toEqual({
                texts: {},
                theme: 'light',
                primaryColor: '#1a4b84'
            });
        });

        it('should handle clicking editable text buttons and saving text', async () => {
            jest.spyOn(window, 'fetch').mockResolvedValueOnce({
                ok: false
            });

            await loadSiteConfig();

            const container = document.getElementById('editable-texts-list');
            const aboutBtn = container.querySelector('button[data-key="about_title"]');
            expect(aboutBtn).not.toBeNull();

            aboutBtn.click();

            const editArea = document.getElementById('text-edit-area');
            expect(editArea.style.display).toBe('block');
            expect(document.getElementById('editing-label').textContent).toContain('כותרת אודות');

            const editor = document.getElementById('site-text-editor');
            editor.value = 'כותרת אודות חדשה';

            const saveBtn = document.getElementById('save-site-text');
            saveBtn.click();

            const previewTitle = document.querySelector('#preview-about-title');
            expect(previewTitle.textContent).toBe('כותרת אודות חדשה');
        });

        it('should set save-onesignal-btn click handler when present in DOM', async () => {
            const mockConfig = {
                texts: {},
                theme: 'light',
                primaryColor: '#1a4b84'
            };

            jest.spyOn(window, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => ({
                    content: encodeToBase64(JSON.stringify(mockConfig)),
                    sha: 'sha-123'
                })
            });

            await loadSiteConfig();

            document.getElementById('site-onesignal-id').value = 'app-new';
            document.getElementById('site-onesignal-rest').value = 'rest-key-new';

            const onesignalBtn = document.getElementById('save-onesignal-btn');
            const event = new Event('click', { cancelable: true });
            await onesignalBtn.onclick(event);

            expect(sessionStorage.getItem('onesignal_rest_key')).toBe('rest-key-new');
        });
    });

    describe('saveAllSiteSettings', () => {
        it('should save site settings successfully', async () => {
            jest.spyOn(window, 'fetch').mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    content: { sha: 'new-sha' }
                })
            });

            document.getElementById('site-theme-select').value = 'dark';
            document.getElementById('site-primary-color').value = '#00ff00';
            document.getElementById('site-onesignal-id').value = 'app-999';
            document.getElementById('site-onesignal-rest').value = 'rest-999';

            await saveAllSiteSettings();

            expect(localStorage.getItem('onesignal_rest_key')).toBe('rest-999');
        });

        it('should handle save error when updateResponse is not ok', async () => {
            jest.spyOn(window, 'fetch').mockResolvedValue({
                ok: false,
                status: 500,
                text: async () => 'Server error'
            });

            await saveAllSiteSettings();
        });
    });

    describe('pingIndexNow', () => {
        it('should handle ping success', async () => {
            jest.spyOn(window, 'fetch').mockResolvedValueOnce({
                ok: true
            });

            const statusEl = document.getElementById('indexnow-status');
            const btn = document.getElementById('ping-indexnow-btn');

            await pingIndexNow();

            expect(statusEl.textContent).toContain('נשלח בהצלחה');
            expect(btn.disabled).toBe(false);
        });

        it('should handle ping failure', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            jest.spyOn(window, 'fetch').mockRejectedValueOnce(new Error('Network error'));

            const statusEl = document.getElementById('indexnow-status');
            const btn = document.getElementById('ping-indexnow-btn');

            await pingIndexNow();

            expect(consoleSpy).toHaveBeenCalledWith('IndexNow ping failed:', expect.any(Error));
            expect(statusEl.textContent).toContain('שגיאה בשליחה: Network error');
            expect(btn.disabled).toBe(false);
        });
    });
});
