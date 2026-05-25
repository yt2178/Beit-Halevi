import { updateAppBadge } from './main.js';

describe('updateAppBadge', () => {
    let originalNavigator;

    beforeAll(() => {
        originalNavigator = global.navigator;
    });

    afterAll(() => {
        global.navigator = originalNavigator;
    });

    beforeEach(() => {
        global.navigator = { ...originalNavigator };
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should do nothing if setAppBadge is not in navigator', () => {
        delete global.navigator.setAppBadge;
        expect(() => updateAppBadge(5)).not.toThrow();
    });

    test('should call navigator.setAppBadge with count if count > 0', () => {
        const mockSetAppBadge = jest.fn().mockResolvedValue();
        global.navigator.setAppBadge = mockSetAppBadge;

        updateAppBadge(5);

        expect(mockSetAppBadge).toHaveBeenCalledWith(5);
    });

    test('should call navigator.clearAppBadge if count is 0', () => {
        const mockSetAppBadge = jest.fn().mockResolvedValue();
        const mockClearAppBadge = jest.fn().mockResolvedValue();
        global.navigator.setAppBadge = mockSetAppBadge;
        global.navigator.clearAppBadge = mockClearAppBadge;

        updateAppBadge(0);

        expect(mockClearAppBadge).toHaveBeenCalled();
        expect(mockSetAppBadge).not.toHaveBeenCalled();
    });

    test('should call navigator.clearAppBadge if count is less than 0', () => {
        const mockSetAppBadge = jest.fn().mockResolvedValue();
        const mockClearAppBadge = jest.fn().mockResolvedValue();
        global.navigator.setAppBadge = mockSetAppBadge;
        global.navigator.clearAppBadge = mockClearAppBadge;

        updateAppBadge(-1);

        expect(mockClearAppBadge).toHaveBeenCalled();
        expect(mockSetAppBadge).not.toHaveBeenCalled();
    });
});
