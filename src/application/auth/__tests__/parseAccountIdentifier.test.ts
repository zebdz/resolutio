import { describe, it, expect } from 'vitest';
import { parseAccountIdentifier } from '../parseAccountIdentifier';

describe('parseAccountIdentifier', () => {
  it('reads an email address', () => {
    const parsed = parseAccountIdentifier('  Ivan@Mail.RU ');

    expect(parsed?.kind).toBe('email');

    if (parsed?.kind === 'email') {
      expect(parsed.email.getValue()).toBe('ivan@mail.ru');
    }
  });

  it('reads an E.164 phone number', () => {
    const parsed = parseAccountIdentifier('+79161234567');

    expect(parsed?.kind).toBe('phone');

    if (parsed?.kind === 'phone') {
      expect(parsed.phone.getValue()).toBe('+79161234567');
    }
  });

  it('tolerates a phone number typed with spaces and dashes', () => {
    const parsed = parseAccountIdentifier('+7 (916) 123-45-67');

    expect(parsed?.kind).toBe('phone');

    if (parsed?.kind === 'phone') {
      expect(parsed.phone.getValue()).toBe('+79161234567');
    }
  });

  it('adds a missing plus to a bare number', () => {
    const parsed = parseAccountIdentifier('79161234567');

    expect(parsed?.kind).toBe('phone');

    if (parsed?.kind === 'phone') {
      expect(parsed.phone.getValue()).toBe('+79161234567');
    }
  });

  it.each([
    ['a bare word', 'ivan'],
    ['empty', ''],
    ['whitespace only', '   '],
    ['a malformed address', 'ivan@'],
    ['an at-sign alone', '@'],
  ])('returns null for %s', (_label, raw) => {
    expect(parseAccountIdentifier(raw)).toBeNull();
  });
});
