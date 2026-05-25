import { getHebrewYear } from './utils.js';

describe('getHebrewYear', () => {
    beforeAll(() => {
        jest.useFakeTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it('returns the correct Hebrew year for a date in 2023', () => {
        jest.setSystemTime(new Date('2023-01-01T00:00:00Z'));
        expect(getHebrewYear()).toBe('5783');
    });

    it('returns the correct Hebrew year for a date in early 2024', () => {
        jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
        expect(getHebrewYear()).toBe('5784');
    });

    it('returns the correct Hebrew year for a date after Rosh Hashanah in 2024', () => {
        jest.setSystemTime(new Date('2024-10-05T00:00:00Z'));
        expect(getHebrewYear()).toBe('5785');
    });
});
