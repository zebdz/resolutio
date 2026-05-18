import { describe, it, expect } from 'vitest';
import { extractReportAttachmentIdsFromBody } from '../extractReportAttachmentIdsFromBody';

describe('extractReportAttachmentIdsFromBody', () => {
  it('returns empty for body without inline images', () => {
    expect(extractReportAttachmentIdsFromBody('# Hello\n\nplain text')).toEqual(
      []
    );
  });

  it('extracts a single attachment id from markdown image', () => {
    const body = '![pic](/api/report-attachments/cmpb66zqp0005c6ij61zasq1a)';
    expect(extractReportAttachmentIdsFromBody(body)).toEqual([
      'cmpb66zqp0005c6ij61zasq1a',
    ]);
  });

  it('extracts multiple unique ids', () => {
    const body = `
      ![a](/api/report-attachments/aaa111)
      ![b](/api/report-attachments/bbb222)
      ![a-again](/api/report-attachments/aaa111)
    `;
    expect(extractReportAttachmentIdsFromBody(body).sort()).toEqual([
      'aaa111',
      'bbb222',
    ]);
  });

  it('ignores external image URLs', () => {
    const body = '![ext](https://example.com/foo.png)';
    expect(extractReportAttachmentIdsFromBody(body)).toEqual([]);
  });

  it('ignores other API routes that look similar', () => {
    const body = '![x](/api/other-resource/abc)';
    expect(extractReportAttachmentIdsFromBody(body)).toEqual([]);
  });

  it('handles raw <img> src attributes too', () => {
    const body = '<img src="/api/report-attachments/abc123" alt="x" />';
    expect(extractReportAttachmentIdsFromBody(body)).toEqual(['abc123']);
  });
});
