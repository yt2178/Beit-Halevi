import { jest } from '@jest/globals';
import { encodeToBase64 } from './admin-core.js';

describe('admin-tasks module', () => {
    let adminTasks;
    let mockFetch;
    let mockPutWithShaRetry;
    let mockLogEvent;
    let mockShowStatus;
    let mockHideStatus;

    beforeAll(async () => {
        // Setup DOM environment BEFORE importing module
        document.body.innerHTML = `
            <div id="tasks-section" style="display: block;">
                <div id="tasks-list"></div>
                <input id="new-task-input" type="text" />
                <button id="add-task-btn">הוסף משימה</button>
                <button class="back-to-dashboard-btn">חזרה</button>
                <button id="bnav-dashboard">דשבורד</button>
            </div>
            <div id="status-overlay" style="display:none;">
                <div id="status-text"></div>
                <div id="status-progress"><div></div></div>
                <button id="close-status-btn"></button>
            </div>
        `;

        // Mock admin-core.js dependencies
        mockPutWithShaRetry = jest.fn();
        mockLogEvent = jest.fn();
        mockShowStatus = jest.fn();
        mockHideStatus = jest.fn();

        jest.unstable_mockModule('./admin-core.js', () => ({
            REPO_OWNER: 'testowner',
            REPO_NAME: 'testrepo',
            TASKS_JSON_PATH: 'data/admin-tasks.json',
            GITHUB_TOKEN: 'test_github_token',
            showStatus: mockShowStatus,
            hideStatus: mockHideStatus,
            encodeToBase64: (str) => {
                const encoder = new TextEncoder();
                const bytes = encoder.encode(str);
                let binary = '';
                bytes.forEach(b => binary += String.fromCharCode(b));
                return btoa(binary);
            },
            decodeBase64ToUtf8: (str) => {
                const binary = atob(str);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                const decoder = new TextDecoder();
                return decoder.decode(bytes);
            },
            putWithShaRetry: mockPutWithShaRetry,
            logEvent: mockLogEvent
        }));

        // Dynamically import the admin-tasks module after mocking DOM and dependencies
        adminTasks = await import('./admin-tasks.js');
    });

    beforeEach(async () => {
        jest.useFakeTimers();

        // Clear mock calls and local storage
        jest.clearAllMocks();
        window.localStorage.clear();

        // Clean up DOM state without replacing DOM nodes (preserving event listeners)
        const input = document.getElementById('new-task-input');
        if (input) input.value = '';
        const tasksList = document.getElementById('tasks-list');
        if (tasksList) tasksList.innerHTML = '';
        const tasksSection = document.getElementById('tasks-section');
        if (tasksSection) tasksSection.style.display = 'block';

        // Setup global fetch mock returning empty tasks list to reset module state
        mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                sha: 'sha_default',
                content: encodeToBase64(JSON.stringify([]))
            })
        });
        window.fetch = mockFetch;

        // Default confirm mock
        window.confirm = jest.fn().mockReturnValue(false);

        // Reset module tasks state
        await adminTasks.loadAndRenderTasks();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('loadAndRenderTasks', () => {
        it('should fetch and render tasks successfully from GitHub API', async () => {
            const initialTasks = [
                { text: 'משימה ראשונה', completed: false, createdAt: '2023-01-01T00:00:00.000Z' },
                { text: 'משימה שנייה', completed: true, createdAt: '2023-01-02T00:00:00.000Z' }
            ];
            const contentJson = JSON.stringify(initialTasks);
            const encodedContent = encodeToBase64(contentJson);

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    sha: 'tasks_sha_123',
                    content: encodedContent
                })
            });

            await adminTasks.loadAndRenderTasks();

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.github.com/repos/testowner/testrepo/contents/data/admin-tasks.json',
                expect.objectContaining({
                    headers: { 'Authorization': 'token test_github_token' },
                    cache: 'no-store'
                })
            );

            const container = document.getElementById('tasks-list');
            const items = container.querySelectorAll('.task-item');
            expect(items.length).toBe(2);
            expect(items[0].querySelector('span').textContent).toBe('משימה ראשונה');
            expect(items[0].querySelector('input[type="checkbox"]').checked).toBe(false);
            expect(items[1].querySelector('span').textContent).toBe('משימה שנייה');
            expect(items[1].querySelector('input[type="checkbox"]').checked).toBe(true);
        });

        it('should handle 404 response from GitHub API as empty task list', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404
            });

            await adminTasks.loadAndRenderTasks();

            const container = document.getElementById('tasks-list');
            expect(container.textContent).toContain('אין משימות פתוחות. עבודה טובה!');
        });

        it('should display error message if fetching tasks fails', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            await adminTasks.loadAndRenderTasks();

            const container = document.getElementById('tasks-list');
            expect(container.textContent).toContain('שגיאה בטעינת משימות: Failed to fetch tasks');
        });

        it('should restore local tasks backup when user confirms prompt', async () => {
            const gitHubTasks = [{ text: 'משימה בשרת', completed: false }];
            const localTasks = [{ text: 'משימה מקומית', completed: false }];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    sha: 'sha_123',
                    content: encodeToBase64(JSON.stringify(gitHubTasks))
                })
            });

            window.localStorage.setItem('admin_local_tasks_backup', JSON.stringify(localTasks));
            window.confirm = jest.fn().mockReturnValue(true);

            await adminTasks.loadAndRenderTasks();

            expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('נמצאו משימות שלא נשמרו לשרת'));
            const container = document.getElementById('tasks-list');
            expect(container.textContent).toContain('משימה מקומית');
            expect(container.textContent).not.toContain('משימה בשרת');
        });

        it('should discard local tasks backup when user rejects prompt', async () => {
            const gitHubTasks = [{ text: 'משימה בשרת', completed: false }];
            const localTasks = [{ text: 'משימה מקומית', completed: false }];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    sha: 'sha_123',
                    content: encodeToBase64(JSON.stringify(gitHubTasks))
                })
            });

            window.localStorage.setItem('admin_local_tasks_backup', JSON.stringify(localTasks));
            window.confirm = jest.fn().mockReturnValue(false);

            await adminTasks.loadAndRenderTasks();

            expect(window.localStorage.getItem('admin_local_tasks_backup')).toBeNull();
            const container = document.getElementById('tasks-list');
            expect(container.textContent).toContain('משימה בשרת');
        });

        it('should handle corrupt local tasks backup JSON gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    sha: 'sha_123',
                    content: encodeToBase64(JSON.stringify([]))
                })
            });

            window.localStorage.setItem('admin_local_tasks_backup', 'invalid-json');

            await adminTasks.loadAndRenderTasks();

            expect(consoleSpy).toHaveBeenCalledWith('Error parsing local tasks:', expect.any(Error));
        });

        it('should update app badge if setAppBadge is supported', async () => {
            const setAppBadgeMock = jest.fn().mockResolvedValue();
            const clearAppBadgeMock = jest.fn().mockResolvedValue();

            Object.defineProperty(navigator, 'setAppBadge', {
                value: setAppBadgeMock,
                configurable: true,
                writable: true
            });
            Object.defineProperty(navigator, 'clearAppBadge', {
                value: clearAppBadgeMock,
                configurable: true,
                writable: true
            });

            const tasks = [
                { text: 'משימה 1', completed: false },
                { text: 'משימה 2', completed: true }
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    sha: 'sha_123',
                    content: encodeToBase64(JSON.stringify(tasks))
                })
            });

            await adminTasks.loadAndRenderTasks();

            expect(setAppBadgeMock).toHaveBeenCalledWith(1);

            // Test clearAppBadge when all tasks completed
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    sha: 'sha_123',
                    content: encodeToBase64(JSON.stringify([{ text: 'משימה 2', completed: true }]))
                })
            });

            await adminTasks.loadAndRenderTasks();
            expect(clearAppBadgeMock).toHaveBeenCalled();
        });
    });

    describe('Task management operations (add, toggle, delete)', () => {
        beforeEach(async () => {
            // Initialize with one task
            const tasks = [{ text: 'משימה קיימת', completed: false }];
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    sha: 'sha_123',
                    content: encodeToBase64(JSON.stringify(tasks))
                })
            });
            await adminTasks.loadAndRenderTasks();
            jest.clearAllMocks();
        });

        it('should add a new task when clicking add button', () => {
            const input = document.getElementById('new-task-input');
            const addBtn = document.getElementById('add-task-btn');

            input.value = 'משימה חדשה';
            addBtn.click();

            expect(input.value).toBe('');
            const container = document.getElementById('tasks-list');
            const items = container.querySelectorAll('.task-item');
            expect(items.length).toBe(2);
            expect(items[0].querySelector('span').textContent).toBe('משימה חדשה');
        });

        it('should add a new task when pressing Enter key in input', () => {
            const input = document.getElementById('new-task-input');

            input.value = 'משימה במקש אנטר';
            const enterEvent = new KeyboardEvent('keypress', { key: 'Enter', bubbles: true });
            input.dispatchEvent(enterEvent);

            const container = document.getElementById('tasks-list');
            const items = container.querySelectorAll('.task-item');
            expect(items.length).toBe(2);
            expect(items[0].querySelector('span').textContent).toBe('משימה במקש אנטר');
        });

        it('should not add a task if input is empty or whitespace', () => {
            const input = document.getElementById('new-task-input');
            const addBtn = document.getElementById('add-task-btn');

            input.value = '   ';
            addBtn.click();

            const container = document.getElementById('tasks-list');
            const items = container.querySelectorAll('.task-item');
            expect(items.length).toBe(1);
        });

        it('should toggle task completion state when checkbox is clicked', () => {
            const container = document.getElementById('tasks-list');
            const checkbox = container.querySelector('input[type="checkbox"]');

            checkbox.click();

            expect(checkbox.checked).toBe(true);
            const taskDiv = container.querySelector('.task-item');
            expect(taskDiv.classList.contains('completed')).toBe(true);
        });

        it('should delete task when delete button is clicked', () => {
            const container = document.getElementById('tasks-list');
            const deleteBtn = container.querySelector('button[title="מחק משימה"]');

            deleteBtn.click();

            expect(container.textContent).toContain('אין משימות פתוחות. עבודה טובה!');
        });
    });

    describe('forceSyncTasks', () => {
        it('should not sync if there are no unsaved changes', async () => {
            await adminTasks.forceSyncTasks();

            expect(mockPutWithShaRetry).not.toHaveBeenCalled();
        });

        it('should sync tasks to GitHub when there are unsaved changes', async () => {
            // Add a task to trigger unsaved changes
            const input = document.getElementById('new-task-input');
            input.value = 'לסנכרן משימה';
            document.getElementById('add-task-btn').click();

            mockPutWithShaRetry.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ content: { sha: 'new_sha_456' } })
            });

            await adminTasks.forceSyncTasks();

            expect(mockShowStatus).toHaveBeenCalledWith('מעדכן משימות ב-GitHub...', 50);
            expect(mockPutWithShaRetry).toHaveBeenCalledWith(
                'https://api.github.com/repos/testowner/testrepo/contents/data/admin-tasks.json',
                expect.objectContaining({
                    message: 'עדכון משימות לביצוע',
                    branch: 'main'
                }),
                'test_github_token',
                'sha_default',
                3,
                expect.any(Function)
            );
            expect(mockLogEvent).toHaveBeenCalledWith('עדכן משימות לביצוע', 'tasks');
            expect(mockShowStatus).toHaveBeenCalledWith('המשימות נשמרו בהצלחה! ✅', 100);

            // Verify status hide timeout
            jest.advanceTimersByTime(1500);
            expect(mockHideStatus).toHaveBeenCalled();
        });

        it('should handle error during sync', async () => {
            // Add a task
            const input = document.getElementById('new-task-input');
            input.value = 'משימה שנכשלה';
            document.getElementById('add-task-btn').click();

            mockPutWithShaRetry.mockRejectedValueOnce(new Error('Network error'));

            await adminTasks.forceSyncTasks();

            expect(mockShowStatus).toHaveBeenCalledWith('שגיאה בשמירת משימות: Network error', null, true);
        });
    });

    describe('Auto sync and event listeners', () => {
        it('should auto-sync 2 seconds after adding/editing/deleting a task', async () => {
            mockPutWithShaRetry.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ content: { sha: 'new_sha_456' } })
            });

            const input = document.getElementById('new-task-input');
            input.value = 'משימה אוטומטית';
            document.getElementById('add-task-btn').click();

            expect(mockPutWithShaRetry).not.toHaveBeenCalled();

            // Advance timers by 2 seconds and flush microtasks
            jest.advanceTimersByTime(2000);
            await Promise.resolve();

            expect(mockPutWithShaRetry).toHaveBeenCalled();
        });

        it('should sync on visibilitychange when hidden and has unsaved changes', async () => {
            const input = document.getElementById('new-task-input');
            input.value = 'משימה מוסתרת';
            document.getElementById('add-task-btn').click();

            mockPutWithShaRetry.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ content: { sha: 'new_sha_456' } })
            });

            Object.defineProperty(document, 'visibilityState', {
                value: 'hidden',
                configurable: true
            });

            const event = new Event('visibilitychange');
            document.dispatchEvent(event);

            expect(mockPutWithShaRetry).toHaveBeenCalled();
        });

        it('should sync on dashboard button click when tasks section is visible', async () => {
            const input = document.getElementById('new-task-input');
            input.value = 'חזרה לדשבורד';
            document.getElementById('add-task-btn').click();

            mockPutWithShaRetry.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ content: { sha: 'new_sha_456' } })
            });

            const backBtn = document.querySelector('.back-to-dashboard-btn');
            backBtn.click();

            expect(mockPutWithShaRetry).toHaveBeenCalled();
        });

        it('should save backup to localStorage periodically if there are unsaved changes', async () => {
            const input = document.getElementById('new-task-input');
            input.value = 'שמירה מקומית בלולאה';
            document.getElementById('add-task-btn').click();

            jest.advanceTimersByTime(10000);

            const storedBackup = window.localStorage.getItem('admin_local_tasks_backup');
            expect(storedBackup).not.toBeNull();
            expect(storedBackup).toContain('שמירה מקומית בלולאה');
        });
    });
});
