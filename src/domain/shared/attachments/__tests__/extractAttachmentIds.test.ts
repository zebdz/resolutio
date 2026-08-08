import { describe, it, expect } from 'vitest';
import { extractAttachmentIds } from '../extractAttachmentIds';

const REPORTS = '/api/report-attachments';
const POLLS = '/api/poll-attachments';

describe('extractAttachmentIds', () => {
  it('returns an empty array when there are no refs', () => {
    expect(extractAttachmentIds('just text', POLLS)).toEqual([]);
  });

  it('extracts an id from markdown image syntax', () => {
    const text = '![photo](/api/poll-attachments/abc123)';
    expect(extractAttachmentIds(text, POLLS)).toEqual(['abc123']);
  });

  it('extracts an id from markdown link syntax', () => {
    const text = '[survey.pdf](/api/poll-attachments/def456)';
    expect(extractAttachmentIds(text, POLLS)).toEqual(['def456']);
  });

  it('deduplicates repeated ids', () => {
    const text =
      '![a](/api/poll-attachments/abc123) ![b](/api/poll-attachments/abc123)';
    expect(extractAttachmentIds(text, POLLS)).toEqual(['abc123']);
  });

  it('ignores refs belonging to a different prefix', () => {
    const text = '![a](/api/report-attachments/abc123)';
    expect(extractAttachmentIds(text, POLLS)).toEqual([]);
  });

  it('still extracts report refs when given the report prefix', () => {
    const text = '![a](/api/report-attachments/abc123)';
    expect(extractAttachmentIds(text, REPORTS)).toEqual(['abc123']);
  });
});
