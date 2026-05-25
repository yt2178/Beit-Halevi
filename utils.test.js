import { parseFrontMatter } from './utils.js';

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