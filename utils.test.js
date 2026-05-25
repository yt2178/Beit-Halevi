import { cleanPath } from './utils.js';

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
    expect(cleanPath('\'hello"')).toBe('hello'); // The regex replaces any quote at start and end independently
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