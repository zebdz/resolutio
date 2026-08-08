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

  // Cases that arise once poll descriptions carry attachment refs. A card
  // preview or PDF export must never show raw `![…](/api/…)` syntax.
  describe('attachment refs in poll descriptions', () => {
    it('reduces an inline image ref to its alt text', () => {
      expect(
        stripMarkdownToPlainText(
          'The fence was moved ![photo](/api/poll-attachments/abc123) as shown.'
        )
      ).toBe('The fence was moved photo as shown.');
    });

    it('reduces a PDF link ref to its label', () => {
      expect(
        stripMarkdownToPlainText(
          'See [survey.pdf](/api/poll-attachments/def456) for details.'
        )
      ).toBe('See survey.pdf for details.');
    });

    it('drops an image ref that has no alt text', () => {
      expect(
        stripMarkdownToPlainText('Before ![](/api/poll-attachments/abc) after')
      ).toBe('Before  after');
    });

    it('leaves no markdown punctuation from a ref-heavy description', () => {
      const out = stripMarkdownToPlainText(
        '## Background\n\n' +
          'The fence moved in **March**.\n' +
          '![photo](/api/poll-attachments/a1)\n' +
          '- Survey confirms it\n' +
          '- Owner not notified\n' +
          '[survey.pdf](/api/poll-attachments/a2)'
      );

      expect(out).not.toContain('![');
      expect(out).not.toContain('](');
      expect(out).not.toContain('/api/poll-attachments');
      expect(out).not.toContain('##');
      expect(out).not.toContain('**');
      expect(out).toContain('Background');
      expect(out).toContain('Survey confirms it');
    });
  });
});
