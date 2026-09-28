import { jest } from '@jest/globals';

jest.unstable_mockModule('./admin-core.js', () => ({
    REPO_OWNER: 'test_owner',
    REPO_NAME: 'test_repo',
    TASKS_JSON_PATH: 'test_path.json',
    GITHUB_TOKEN: 'test_token',
    showStatus: jest.fn(),
    hideStatus: jest.fn(),
    encodeToBase64: jest.fn(),
    decodeBase64ToUtf8: jest.fn(),
    putWithShaRetry: jest.fn()
}));

const adminTasksModule = await import('./admin-tasks.js');

describe('admin-tasks.js loadAndRenderTasks', () => {
    let originalFetch;
    let originalGetItem;
    let container;

    beforeAll(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="tasks-list"></div>
            <input id="new-task-input" />
        `;
        originalFetch = global.fetch;
        originalGetItem = global.localStorage.getItem;
    });

    afterAll(() => {
        global.fetch = originalFetch;
        global.localStorage.getItem = originalGetItem;
    });

    beforeEach(() => {
        container = document.getElementById('tasks-list');
        container.innerHTML = '';
        jest.clearAllMocks();
    });

    it('should catch fetch network errors and display error message', async () => {
        // Mock fetch to throw a network error
        global.fetch = jest.fn(() => Promise.reject(new Error('Network failure')));

        await adminTasksModule.loadAndRenderTasks();

        expect(container.innerHTML).toContain('שגיאה בטעינת משימות: Network failure');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should catch non-ok status codes (excluding 404) and display error message', async () => {
        // Mock fetch to return a 500 Internal Server Error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ message: 'Internal Server Error' })
        }));

        await adminTasksModule.loadAndRenderTasks();

        expect(container.innerHTML).toContain('שגיאה בטעינת משימות: Failed to fetch tasks');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle 404 status correctly (empty task list)', async () => {
        // Mock fetch to return 404
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 404
        }));

        global.localStorage.getItem = jest.fn(() => null);

        await adminTasksModule.loadAndRenderTasks();

        // 404 means no tasks exist yet. It should not render an error.
        expect(container.innerHTML).not.toContain('שגיאה בטעינת משימות');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
