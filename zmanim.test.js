import { jest } from '@jest/globals';

describe('zmanim.js - localStorage and initialization', () => {
    let testCounter = 0;
    let getItemSpy;
    let setItemSpy;

    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});

        getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);
        setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});

        document.body.innerHTML = `
            <div id="zmanim-container"></div>
        `;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    test('defaults to DEFAULT_CITY (ראש העין) when localStorage.getItem throws an error', async () => {
        getItemSpy.mockImplementation(() => {
            throw new Error('Access denied to localStorage');
        });

        const modulePath = `./zmanim.js?t=${++testCounter}`;
        const { initZmanim } = await import(modulePath);

        await initZmanim();

        const cityNameEl = document.getElementById('current-city-name');
        expect(cityNameEl).not.toBeNull();
        expect(cityNameEl.textContent).toBe('ראש העין');
    });

    test('defaults to DEFAULT_CITY when localStorage.getItem returns invalid JSON', async () => {
        getItemSpy.mockImplementation(() => '{invalid-json');

        const modulePath = `./zmanim.js?t=${++testCounter}`;
        const { initZmanim } = await import(modulePath);

        await initZmanim();

        const cityNameEl = document.getElementById('current-city-name');
        expect(cityNameEl).not.toBeNull();
        expect(cityNameEl.textContent).toBe('ראש העין');
    });

    test('defaults to DEFAULT_CITY when localStorage.getItem returns null', async () => {
        getItemSpy.mockImplementation(() => null);

        const modulePath = `./zmanim.js?t=${++testCounter}`;
        const { initZmanim } = await import(modulePath);

        await initZmanim();

        const cityNameEl = document.getElementById('current-city-name');
        expect(cityNameEl).not.toBeNull();
        expect(cityNameEl.textContent).toBe('ראש העין');
    });

    test('loads saved city from localStorage when valid JSON is present', async () => {
        const savedCity = { name: 'ירושלים', geonameid: '281184' };
        getItemSpy.mockImplementation((key) => {
            if (key === 'zmanim_city') {
                return JSON.stringify(savedCity);
            }
            return null;
        });

        const modulePath = `./zmanim.js?t=${++testCounter}`;
        const { initZmanim } = await import(modulePath);

        await initZmanim();

        const cityNameEl = document.getElementById('current-city-name');
        expect(cityNameEl).not.toBeNull();
        expect(cityNameEl.textContent).toBe('ירושלים');
    });

    test('returns early if zmanim-container does not exist', async () => {
        document.body.innerHTML = '';
        const modulePath = `./zmanim.js?t=${++testCounter}`;
        const { initZmanim } = await import(modulePath);

        await expect(initZmanim()).resolves.toBeUndefined();
    });

    test('allows user to open city modal, choose a new city, and update localStorage', async () => {
        getItemSpy.mockImplementation(() => null);

        const modulePath = `./zmanim.js?t=${++testCounter}`;
        const { initZmanim } = await import(modulePath);

        await initZmanim();

        const changeBtn = document.getElementById('change-city-btn');
        const modal = document.getElementById('city-modal');
        expect(modal.classList.contains('active')).toBe(false);

        // Open modal
        changeBtn.click();
        expect(modal.classList.contains('active')).toBe(true);

        // Close modal using close button
        const closeBtn = document.querySelector('.city-close');
        closeBtn.click();
        expect(modal.classList.contains('active')).toBe(false);

        // Re-open modal and select a city option
        changeBtn.click();
        const cityOptionBtns = document.querySelectorAll('.city-option');
        const jerusalemBtn = Array.from(cityOptionBtns).find(b => b.dataset.name === 'ירושלים');
        expect(jerusalemBtn).toBeDefined();

        jerusalemBtn.click();

        // Modal should close and current city name should update
        expect(modal.classList.contains('active')).toBe(false);
        expect(document.getElementById('current-city-name').textContent).toBe('ירושלים');
        expect(setItemSpy).toHaveBeenCalledWith(
            'zmanim_city',
            JSON.stringify({ name: 'ירושלים', geonameid: '281184' })
        );
    });

    test('handles error gracefully when fetch fails in loadZmanimData', async () => {
        getItemSpy.mockImplementation(() => null);
        global.fetch = jest.fn(() => Promise.reject(new Error('Network Error')));

        const modulePath = `./zmanim.js?t=${++testCounter}`;
        const { initZmanim } = await import(modulePath);

        await initZmanim();

        const timesContainer = document.getElementById('zmanim-times');
        expect(timesContainer.querySelector('.error-msg')).not.toBeNull();
        expect(timesContainer.querySelector('.error-msg').textContent).toBe('שגיאה בטעינת זמנים');
    });
});
