import { describe, it, expect } from 'vitest';
import { maskEmail } from '../maskEmail';

describe('maskEmail', () => {
  it('keeps the first character and the domain', () => {
    expect(maskEmail('ivan@mail.ru')).toBe('i•••@mail.ru');
  });

  it('masks a single-character local part without revealing it', () => {
    expect(maskEmail('i@mail.ru')).toBe('•••@mail.ru');
  });

  it('leaves a malformed value fully masked', () => {
    expect(maskEmail('not-an-email')).toBe('•••');
  });

  it('does not leak the rest of the local part', () => {
    expect(maskEmail('alexander.petrov@mail.ru')).not.toContain('lexander');
  });
});
