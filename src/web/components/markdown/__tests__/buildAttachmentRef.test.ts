import { describe, it, expect } from 'vitest';
import { buildAttachmentRef } from '../buildAttachmentRef';

const POLLS = '/api/poll-attachments';

describe('buildAttachmentRef', () => {
  it('uses image syntax for a PNG so it renders inline', () => {
    const ref = buildAttachmentRef({
      fileName: 'photo.png',
      mimeType: 'image/png',
      apiPrefix: POLLS,
      id: 'abc123',
    });

    expect(ref).toContain('![photo.png](/api/poll-attachments/abc123)');
  });

  it('uses image syntax for JPEG and WebP', () => {
    for (const mime of ['image/jpeg', 'image/webp']) {
      const ref = buildAttachmentRef({
        fileName: 'x',
        mimeType: mime,
        apiPrefix: POLLS,
        id: 'id1',
      });

      expect(ref.trimStart().startsWith('!')).toBe(true);
    }
  });

  // Regression guard: the editor previously emitted image syntax for every
  // upload, so a PDF became <img src="....pdf"> — a broken image.
  it('uses link syntax for a PDF, not image syntax', () => {
    const ref = buildAttachmentRef({
      fileName: 'survey.pdf',
      mimeType: 'application/pdf',
      apiPrefix: POLLS,
      id: 'def456',
    });

    expect(ref).toContain('[survey.pdf](/api/poll-attachments/def456)');
    expect(ref).not.toContain('![');
  });

  it('falls back to link syntax for an unknown type', () => {
    const ref = buildAttachmentRef({
      fileName: 'thing.bin',
      mimeType: 'application/octet-stream',
      apiPrefix: POLLS,
      id: 'ghi789',
    });

    expect(ref).not.toContain('![');
  });

  it('honours the api prefix it is given', () => {
    const ref = buildAttachmentRef({
      fileName: 'photo.png',
      mimeType: 'image/png',
      apiPrefix: '/api/report-attachments',
      id: 'abc123',
    });

    expect(ref).toContain('/api/report-attachments/abc123');
  });

  it('surrounds the ref with blank lines so it forms its own block', () => {
    const ref = buildAttachmentRef({
      fileName: 'photo.png',
      mimeType: 'image/png',
      apiPrefix: POLLS,
      id: 'abc123',
    });

    expect(ref.startsWith('\n\n')).toBe(true);
    expect(ref.endsWith('\n')).toBe(true);
  });

  // A ']' in the file name would otherwise terminate the link label early and
  // leave the rest of the name as stray text.
  it('escapes brackets in the file name', () => {
    const ref = buildAttachmentRef({
      fileName: 'a]b[c.png',
      mimeType: 'image/png',
      apiPrefix: POLLS,
      id: 'abc123',
    });

    expect(ref).toContain('a\\]b\\[c.png');
  });
});
