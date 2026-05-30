import { jest } from '@jest/globals';
import { updateGithubAuth, GITHUB_TOKEN, GITHUB_USERNAME } from './admin-core.js';

describe('updateGithubAuth', () => {
    let originalGetItem;
    let originalSetItem;
    let mockSetItem;

    beforeEach(() => {
        // Clear mocks before each test
        jest.clearAllMocks();

        mockSetItem = jest.fn();

        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: jest.fn(),
                setItem: mockSetItem,
                clear: jest.fn()
            },
            writable: true
        });

        // Some code uses global.localStorage
        global.localStorage = window.localStorage;
    });

    it('should update GITHUB_TOKEN and GITHUB_USERNAME when valid strings are provided', () => {
        updateGithubAuth('my_new_token', 'my_new_username');
        expect(GITHUB_TOKEN).toBe('my_new_token');
        expect(GITHUB_USERNAME).toBe('my_new_username');
    });

    it('should call localStorage.setItem with "ghToken" when a valid token is provided', () => {
        updateGithubAuth('test_token', null);
        expect(mockSetItem).toHaveBeenCalledWith('ghToken', 'test_token');
        // ghUsername shouldn't be set because username was null
        expect(mockSetItem).toHaveBeenCalledTimes(1);
    });

    it('should call localStorage.setItem with "ghUsername" when a valid username is provided', () => {
        updateGithubAuth(null, 'test_username');
        expect(mockSetItem).toHaveBeenCalledWith('ghUsername', 'test_username');
        // ghToken shouldn't be set because token was null
        expect(mockSetItem).toHaveBeenCalledTimes(1);
    });

    it('should set both items in localStorage when both are provided', () => {
        updateGithubAuth('token_123', 'user_123');
        expect(mockSetItem).toHaveBeenCalledWith('ghToken', 'token_123');
        expect(mockSetItem).toHaveBeenCalledWith('ghUsername', 'user_123');
        expect(mockSetItem).toHaveBeenCalledTimes(2);
    });

    it('should not call localStorage.setItem when arguments are null', () => {
        updateGithubAuth(null, null);
        expect(mockSetItem).not.toHaveBeenCalled();
    });
});
