import { describe, it, expect } from 'vitest';
import { isAllowedAttachmentSrc } from '../isAllowedAttachmentSrc';

const POLLS = '/api/poll-attachments';
const REPORTS = '/api/report-attachments';

describe('isAllowedAttachmentSrc', () => {
  it('accepts a src under the given prefix', () => {
    expect(isAllowedAttachmentSrc('/api/poll-attachments/abc', POLLS)).toBe(
      true
    );
  });

  it('rejects an external URL', () => {
    expect(isAllowedAttachmentSrc('https://evil.example/x.png', POLLS)).toBe(
      false
    );
  });

  it('rejects a src belonging to the other aggregate', () => {
    expect(isAllowedAttachmentSrc('/api/report-attachments/abc', POLLS)).toBe(
      false
    );
    expect(isAllowedAttachmentSrc('/api/poll-attachments/abc', REPORTS)).toBe(
      false
    );
  });

  // The leading slash in the prefix is what makes this safe: a
  // protocol-relative URL starts with a second slash, so it cannot match.
  it('rejects a protocol-relative URL that merely contains the prefix', () => {
    expect(
      isAllowedAttachmentSrc('//evil.example/api/poll-attachments/abc', POLLS)
    ).toBe(false);
  });

  it('rejects an absolute URL that merely contains the prefix', () => {
    expect(
      isAllowedAttachmentSrc(
        'https://evil.example/api/poll-attachments/abc',
        POLLS
      )
    ).toBe(false);
  });

  it('rejects the bare prefix with no id', () => {
    expect(isAllowedAttachmentSrc('/api/poll-attachments', POLLS)).toBe(false);
  });

  it('rejects a prefix used as a path segment of another route', () => {
    expect(
      isAllowedAttachmentSrc('/api/poll-attachments-evil/abc', POLLS)
    ).toBe(false);
  });
});
