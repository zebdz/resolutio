import { describe, it, expect } from 'vitest';
import { normalizeFormText } from '../normalizeFormText';

describe('normalizeFormText', () => {
  it('leaves single-line text untouched', () => {
    expect(normalizeFormText('hello')).toBe('hello');
  });

  it('converts CRLF back to LF', () => {
    expect(normalizeFormText('a\r\nb')).toBe('a\nb');
  });

  // The multipart/form-data encoding algorithm rewrites every lone LF as
  // CRLF, so a description typed with N line breaks arrives N characters
  // longer than the author typed. Without this, a body sitting exactly on the
  // limit is rejected with a length the author cannot see.
  it('restores the length the author actually typed', () => {
    const typed = 'a\nb\nc\nd';
    const transmitted = typed.replace(/\n/g, '\r\n');

    expect(transmitted.length).toBe(typed.length + 3);
    expect(normalizeFormText(transmitted)).toHaveLength(typed.length);
  });

  it('normalizes a lone CR too', () => {
    expect(normalizeFormText('a\rb')).toBe('a\nb');
  });

  it('handles consecutive newlines', () => {
    expect(normalizeFormText('a\r\n\r\nb')).toBe('a\n\nb');
  });

  it('returns an empty string unchanged', () => {
    expect(normalizeFormText('')).toBe('');
  });

  it('coerces a null form value to an empty string', () => {
    expect(normalizeFormText(null)).toBe('');
  });

  it('coerces a missing form value to an empty string', () => {
    expect(normalizeFormText(undefined)).toBe('');
  });
});
