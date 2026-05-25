import { focusLock } from './utils.js';

describe('focusLock', () => {
    let modalElement;
    let button1;
    let button2;
    let button3;

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
        // We will query elements directly to check focus
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

        // Move focus to the last element
        button2.focus();
        expect(document.activeElement).toBe(button2);

        // Simulate Tab keypress on the modal
        const event = new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9 });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

        modalElement.dispatchEvent(event);

        expect(document.activeElement).toBe(button1);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    test('should wrap focus to the last element when pressing Shift+Tab on the first element', () => {
        focusLock(modalElement);

        // Focus should be on the first element by default, but let's be explicit
        button1.focus();
        expect(document.activeElement).toBe(button1);

        // Simulate Shift+Tab keypress on the modal
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

        // Simulate Tab keypress
        const event = new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9 });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

        modalElement.dispatchEvent(event);

        // It shouldn't prevent default, allowing browser to handle normal tab
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should not interfere with normal Shift+Tab navigation within the modal', () => {
        focusLock(modalElement);

        const linkElement = document.getElementById('link');
        linkElement.focus();
        expect(document.activeElement).toBe(linkElement);

        // Simulate Shift+Tab keypress
        const event = new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, shiftKey: true });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

        modalElement.dispatchEvent(event);

        // It shouldn't prevent default
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should ignore non-Tab key events', () => {
        focusLock(modalElement);

        button2.focus();

        const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 });
        Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

        modalElement.dispatchEvent(event);

        // Should ignore and not prevent default or change focus
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(button2);
    });
});
