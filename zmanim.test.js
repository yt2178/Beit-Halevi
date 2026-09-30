import { jest } from '@jest/globals';

describe('zmanim.js - localStorage initialization & error handling', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="zmanim-container"></div>';
        jest.restoreAllMocks();
    });

    it('defaults currentCity to DEFAULT_CITY when localStorage.getItem throws an error', async () => {
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('Storage access denied');
        });

        const { initZmanim } = await import(`./zmanim.js?case=error_${Date.now()}_1`);
        await initZmanim();

        const cityNameEl = document.getElementById('current-city-name');
        expect(cityNameEl.textContent).toBe('ראש העין');
    });

    it('defaults currentCity to DEFAULT_CITY when localStorage.getItem returns invalid JSON', async () => {
        jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('{invalid-json');

        const { initZmanim } = await import(`./zmanim.js?case=invalid_json_${Date.now()}_2`);
        await initZmanim();

        const cityNameEl = document.getElementById('current-city-name');
        expect(cityNameEl.textContent).toBe('ראש העין');
    });

    it('defaults currentCity to DEFAULT_CITY when localStorage.getItem returns null', async () => {
        jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

        const { initZmanim } = await import(`./zmanim.js?case=null_${Date.now()}_3`);
        await initZmanim();

        const cityNameEl = document.getElementById('current-city-name');
        expect(cityNameEl.textContent).toBe('ראש העין');
    });

    it('loads saved city from localStorage when valid JSON is stored', async () => {
        const savedCity = { name: "ירושלים", geonameid: "281184" };
        jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(savedCity));

        const { initZmanim } = await import(`./zmanim.js?case=valid_${Date.now()}_4`);
        await initZmanim();

        const cityNameEl = document.getElementById('current-city-name');
        expect(cityNameEl.textContent).toBe('ירושלים');
    });
});

describe('zmanim.js - initZmanim DOM and interactive behavior', () => {
    let initZmanim;

    beforeAll(async () => {
        const module = await import(`./zmanim.js?case=main_${Date.now()}`);
        initZmanim = module.initZmanim;
    });

    beforeEach(() => {
        document.body.innerHTML = '<div id="zmanim-container"></div>';
        jest.clearAllMocks();
    });

    it('returns early if zmanim-container is missing', async () => {
        document.body.innerHTML = '';
        await expect(initZmanim()).resolves.not.toThrow();
    });

    it('renders widget structure and opens/closes city modal', async () => {
        await initZmanim();

        const changeBtn = document.getElementById('change-city-btn');
        const modal = document.getElementById('city-modal');
        const closeBtn = document.querySelector('.city-close');

        expect(modal.classList.contains('active')).toBe(false);

        changeBtn.click();
        expect(modal.classList.contains('active')).toBe(true);

        closeBtn.click();
        expect(modal.classList.contains('active')).toBe(false);
    });

    it('handles selecting a new city from modal options', async () => {
        const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
        await initZmanim();

        const jerusalemBtn = document.querySelector('.city-option[data-name="ירושלים"]');
        expect(jerusalemBtn).not.toBeNull();

        jerusalemBtn.click();

        const cityNameEl = document.getElementById('current-city-name');
        expect(cityNameEl.textContent).toBe('ירושלים');
        expect(setItemSpy).toHaveBeenCalledWith(
            'zmanim_city',
            JSON.stringify({ name: "ירושלים", geonameid: "281184" })
        );
    });

    it('handles network errors during loadZmanimData gracefully', async () => {
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await initZmanim();

        const timesContainer = document.getElementById('zmanim-times');
        expect(timesContainer.querySelector('.error-msg')).not.toBeNull();
        expect(timesContainer.querySelector('.error-msg').textContent).toBe('שגיאה בטעינת זמנים');

        global.fetch = originalFetch;
        consoleErrorSpy.mockRestore();
    });
});
