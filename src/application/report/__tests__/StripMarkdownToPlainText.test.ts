import { describe, it, expect } from 'vitest';
import { stripMarkdownToPlainText } from '../StripMarkdownToPlainText';

describe('stripMarkdownToPlainText', () => {
  it('strips heading hashes', () => {
    expect(stripMarkdownToPlainText('# Hello\n## World')).toContain('Hello');
    expect(stripMarkdownToPlainText('# Hello\n## World')).toContain('World');
    expect(stripMarkdownToPlainText('# Hello\n## World')).not.toContain('#');
  });

  it('strips bold and italic markers', () => {
    expect(stripMarkdownToPlainText('**bold** and _italic_')).toBe(
      'bold and italic'
    );
  });

  it('strips link syntax keeping text', () => {
    expect(stripMarkdownToPlainText('[text](https://example.com)')).toBe(
      'text'
    );
  });

  it('strips image syntax keeping alt text', () => {
    expect(stripMarkdownToPlainText('![alt](https://x/y.png)')).toBe('alt');
  });

  it('strips code blocks (content kept; fences removed)', () => {
    expect(stripMarkdownToPlainText('```js\nconsole.log("x")\n```')).toContain(
      'console.log'
    );
    expect(
      stripMarkdownToPlainText('```js\nconsole.log("x")\n```')
    ).not.toContain('```');
  });

  it('keeps plain paragraphs intact', () => {
    expect(stripMarkdownToPlainText('Just a paragraph.')).toBe(
      'Just a paragraph.'
    );
  });
});
