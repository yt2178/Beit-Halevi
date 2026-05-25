import { jest } from '@jest/globals';
import { fetchStaticJson, focusLock, getHebrewYear, parseFrontMatter, cleanPath } from './utils.js';

describe('fetchStaticJson', () => {
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;

    beforeEach(() => {
        // Silence console.error for clean test output
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('should return parsed JSON when fetch is successful', async () => {
        const mockData = { items: [1, 2, 3] };
        global.fetch = jest.fn(async (url) => {
            expect(url).toBe('./data/news.json');
            return {
                ok: true,
                json: async () => mockData
            };
        });

        const result = await fetchStaticJson('news');
        expect(result).toEqual(mockData);
    });

    it('should return error object when response is not ok', async () => {
        global.fetch = jest.fn(async (url) => {
            return {
                ok: false
            };
        });

        const result = await fetchStaticJson('news');
        expect(result).toEqual({
            error: true,
            message: 'אירעה שגיאה בטעינת הנתונים (JSON). נא לנסות שוב מאוחר יותר.'
        });
    });

    it('should return error object when fetch throws a network error', async () => {
        global.fetch = jest.fn(async (url) => {
            throw new Error('Network failure');
        });

        const result = await fetchStaticJson('gallery');
        expect(result).toEqual({
            error: true,
            message: 'אירעה שגיאה בטעינת הנתונים (JSON). נא לנסות שוב מאוחר יותר.'
        });
    });
});

describe('focusLock', () => {
    let modalElement;
    let button1;
    let button2;

    beforeEach(() => {
        // Set up the DOM for testing
        document.body.innerHTML = `
            <div id="modal">
                <button id="btn1">Button 1</button>
                <a href="#" id="link">Link</a>
                <input type="text" id="input" />
                <button id="btn2">Button 2</button>
            </div>
        `;
        modalElement = document.getElementById('modal');
        button1 = document.getElementById('btn1');
        button2 = document.getElementById('btn2');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.restoreAllMocks();
    });

    test('should focus the focusTarget if provided', () => {
        const inputElement = document.getElementById('input');
        focusLock(modalElement, inputElement);

        expect(document.activeElement).toBe(inputElement);
    });

    test('should focus the first focusable element if focusTarget is not provided', () => {
        focusLock(modalElement);

        expect(document.activeElement).toBe(button1);
    });

    test('should wrap focus to the first element when pressing Tab on the last element', () => {
        focusLock(modalElement);

        button2.focus();
        expect(document.activeElement).toBe(button2);

        const event = new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9 });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

        modalElement.dispatchEvent(event);

        expect(document.activeElement).toBe(button1);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    test('should wrap focus to the last element when pressing Shift+Tab on the first element', () => {
        focusLock(modalElement);

        button1.focus();
        expect(document.activeElement).toBe(button1);

        const event = new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, shiftKey: true });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

        modalElement.dispatchEvent(event);

        expect(document.activeElement).toBe(button2);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    test('should not interfere with normal Tab navigation within the modal', () => {
        focusLock(modalElement);

        const linkElement = document.getElementById('link');
        linkElement.focus();
        expect(document.activeElement).toBe(linkElement);

        const event = new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9 });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

        modalElement.dispatchEvent(event);

        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should not interfere with normal Shift+Tab navigation within the modal', () => {
        focusLock(modalElement);

        const linkElement = document.getElementById('link');
        linkElement.focus();
        expect(document.activeElement).toBe(linkElement);

        const event = new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, shiftKey: true });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

        modalElement.dispatchEvent(event);

        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should ignore non-Tab key events', () => {
        focusLock(modalElement);

        button2.focus();

        const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

        modalElement.dispatchEvent(event);

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(button2);
    });
});

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

describe('parseFrontMatter', () => {
    it('should return empty data and original content when no Front Matter is present', () => {
        const content = 'This is just some content without Front Matter.';
        const result = parseFrontMatter(content);
        expect(result.data).toEqual({});
        expect(result.content).toBe(content);
    });

    it('should handle empty Front Matter', () => {
        const content = '---\n---\nThis is the body.';
        const result = parseFrontMatter(content);
        expect(result.data).toEqual({});
        expect(result.content).toBe('This is the body.');
    });

    it('should parse simple key-value pairs', () => {
        const content = '---\ntitle: My Title\ndate: 2023-10-27\n---\nBody content here.';
        const result = parseFrontMatter(content);
        expect(result.data).toEqual({
            title: 'My Title',
            date: '2023-10-27'
        });
        expect(result.content).toBe('Body content here.');
    });

    it('should parse quoted string values and remove quotes', () => {
        const content = '---\ntitle: "Quoted Title"\ndescription: \'Quoted Description\'\n---\nContent.';
        const result = parseFrontMatter(content);
        expect(result.data).toEqual({
            title: 'Quoted Title',
            description: 'Quoted Description'
        });
        expect(result.content).toBe('Content.');
    });

    it('should parse a list of values', () => {
        const content = '---\ntags:\n- tag1\n- tag2\n- "tag3"\n---\nContent.';
        const result = parseFrontMatter(content);
        expect(result.data).toEqual({
            tags: ['tag1', 'tag2', 'tag3']
        });
        expect(result.content).toBe('Content.');
    });

    it('should parse mixed key-values and lists', () => {
        const content = '---\ntitle: Mixed Data\ntags:\n- one\n- two\nauthor: John Doe\ncategories:\n- news\n- updates\n---\nContent here.';
        const result = parseFrontMatter(content);
        expect(result.data).toEqual({
            title: 'Mixed Data',
            tags: ['one', 'two'],
            author: 'John Doe',
            categories: ['news', 'updates']
        });
        expect(result.content).toBe('Content here.');
    });

    it('should ignore malformed lines', () => {
        const content = '---\ntitle: Correct\nmalformed_line\nauthor: John\n---\nContent.';
        const result = parseFrontMatter(content);
        expect(result.data).toEqual({
            title: 'Correct',
            author: 'John'
        });
        expect(result.content).toBe('Content.');
    });
});

describe('cleanPath', () => {
  it('returns empty string for falsy inputs', () => {
    expect(cleanPath(null)).toBe('');
    expect(cleanPath(undefined)).toBe('');
    expect(cleanPath('')).toBe('');
    expect(cleanPath(0)).toBe('');
  });

  it('trims whitespace', () => {
    expect(cleanPath('  hello ')).toBe('hello');
  });

  it('removes leading "- "', () => {
    expect(cleanPath('- hello')).toBe('hello');
  });

  it('removes leading and trailing quotes', () => {
    expect(cleanPath('"hello"')).toBe('hello');
    expect(cleanPath("'hello'")).toBe('hello');
    expect(cleanPath('\'hello"')).toBe('hello');
  });

  it('removes leading slashes and dot-slashes', () => {
    expect(cleanPath('./hello')).toBe('hello');
    expect(cleanPath('/hello')).toBe('hello');
    expect(cleanPath('///hello')).toBe('hello');
    expect(cleanPath('././hello')).toBe('hello');
  });

  it('decodes URI components', () => {
    expect(cleanPath('hello%20world')).toBe('hello world');
    expect(cleanPath('%D7%A9%D7%9C%D7%95%D7%9D')).toBe('שלום');
  });

  it('handles invalid URI components gracefully', () => {
    expect(cleanPath('hello%2')).toBe('hello%2');
  });

  it('handles combination of edge cases', () => {
    expect(cleanPath('  - "./hello%20world"  ')).toBe('hello world');
  });
});
