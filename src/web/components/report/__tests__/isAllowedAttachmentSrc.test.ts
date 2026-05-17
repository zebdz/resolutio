import { describe, it, expect } from 'vitest';
import { isAllowedAttachmentSrc } from '../isAllowedAttachmentSrc';

describe('isAllowedAttachmentSrc', () => {
  it('allows /api/report-attachments/ paths', () => {
    expect(isAllowedAttachmentSrc('/api/report-attachments/abc123')).toBe(true);
  });

  it('disallows external URLs', () => {
    expect(isAllowedAttachmentSrc('https://evil.com/image.png')).toBe(false);
  });

  it('disallows other API paths', () => {
    expect(isAllowedAttachmentSrc('/api/other/abc123')).toBe(false);
  });
});
