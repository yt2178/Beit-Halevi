import { jest } from '@jest/globals';
import { initZmanim } from './zmanim.js';

describe('zmanim.js - initZmanim', () => {
    let container;
    const originalFetch = global.fetch;
    let setItemSpy;

    beforeEach(() => {
        document.body.innerHTML = '<div id="zmanim-container"></div>';
        container = document.getElementById('zmanim-container');

        setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

        // Mock fetch with sample responses for Hebcal APIs
        global.fetch = jest.fn((url) => {
            if (url.includes('/zmanim')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        times: {
                            alotHaShachar: "2023-10-27T05:00:00+03:00",
                            sunrise: "2023-10-27T06:30:00+03:00",
                            sofZmanShma: "2023-10-27T09:15:00+03:00",
                            sofZmanTfilla: "2023-10-27T10:15:00+03:00",
                            chatzot: "2023-10-27T12:30:00+03:00",
                            sunset: "2023-10-27T18:00:00+03:00",
                            tzeit50min: "2023-10-27T18:50:00+03:00"
                        }
                    })
                });
            }
            if (url.includes('/converter')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        hebrew: 'י"ב מרחשון תשפ"ד'
                    })
                });
            }
            if (url.includes('/shabbat')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        items: [
                            { category: 'parashat', hebrew: 'פרשת וירא' }
                        ]
                    })
                });
            }
            return Promise.reject(new Error(`Unknown URL: ${url}`));
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
        localStorage.clear();
    });

    test('returns early if #zmanim-container is missing from DOM', async () => {
        document.body.innerHTML = '';
        await initZmanim();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('renders widget structure and populates zmanim data', async () => {
        await initZmanim();

        expect(container.querySelector('.zmanim-widget')).not.toBeNull();
        expect(container.querySelector('#city-modal')).not.toBeNull();

        const hebrewDateEl = document.getElementById('hebrew-date');
        const parashaEl = document.getElementById('parasha-name');
        const cityNameEl = document.getElementById('current-city-name');
        const timesContainer = document.getElementById('zmanim-times');

        expect(hebrewDateEl.textContent).toBe('י"ב מרחשון תשפ"ד');
        expect(parashaEl.textContent).toBe('פרשת וירא');
        expect(cityNameEl.textContent).toBe('ראש העין');

        const zmanItems = timesContainer.querySelectorAll('.zman-item');
        expect(zmanItems.length).toBe(7);

        const firstItemLabel = zmanItems[0].querySelector('.zman-label');
        expect(firstItemLabel.textContent).toBe('עלות השחר');
    });

    test('opens modal when clicking #change-city-btn and closes when clicking .city-close', async () => {
        await initZmanim();

        const modal = document.getElementById('city-modal');
        const changeBtn = document.getElementById('change-city-btn');
        const closeSpan = container.querySelector('.city-close');

        expect(modal.classList.contains('active')).toBe(false);

        changeBtn.click();
        expect(modal.classList.contains('active')).toBe(true);

        closeSpan.onclick();
        expect(modal.classList.contains('active')).toBe(false);
    });

    test('changes city when a city button is clicked in the modal', async () => {
        await initZmanim();

        const modal = document.getElementById('city-modal');
        const jerusalemBtn = Array.from(container.querySelectorAll('.city-option'))
            .find(btn => btn.dataset.name === 'ירושלים');

        expect(jerusalemBtn).toBeDefined();

        jerusalemBtn.click();

        // Wait for loadZmanimData inside city click listener
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(document.getElementById('current-city-name').textContent).toBe('ירושלים');
        expect(modal.classList.contains('active')).toBe(false);

        expect(setItemSpy).toHaveBeenCalledWith(
            'zmanim_city',
            JSON.stringify({ name: 'ירושלים', geonameid: '281184' })
        );

        expect(jerusalemBtn.classList.contains('active')).toBe(true);
    });

    test('displays error message when loadZmanimData encounters an error', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

        await initZmanim();

        const timesContainer = document.getElementById('zmanim-times');
        expect(timesContainer.querySelector('.error-msg')).not.toBeNull();
        expect(timesContainer.querySelector('.error-msg').textContent).toBe('שגיאה בטעינת זמנים');
    });

    test('handles missing optional fields in API responses gracefully', async () => {
        global.fetch = jest.fn((url) => {
            if (url.includes('/zmanim')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ times: {} })
                });
            }
            if (url.includes('/converter')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ hebrew: 'תשפ"ד' })
                });
            }
            if (url.includes('/shabbat')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ items: [] })
                });
            }
        });

        await initZmanim();

        const parashaEl = document.getElementById('parasha-name');
        expect(parashaEl.textContent).toBe('');

        const timesContainer = document.getElementById('zmanim-times');
        const zmanTimes = timesContainer.querySelectorAll('.zman-time');
        zmanTimes.forEach(timeSpan => {
            expect(timeSpan.textContent).toBe('--:--');
        });
    });
});
