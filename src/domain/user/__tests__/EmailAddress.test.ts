import { describe, it, expect } from 'vitest';
import { EmailAddress } from '../EmailAddress';
import { UserDomainCodes } from '../UserDomainCodes';

describe('EmailAddress', () => {
  it('accepts a well-formed address', () => {
    expect(EmailAddress.create('ivan@mail.ru').getValue()).toBe('ivan@mail.ru');
  });

  // Normalisation is the whole reason the unique index means anything: without
  // it "A@mail.ru" and "a@mail.ru" are two rows a human reads as one account.
  it('normalizes to trimmed lowercase', () => {
    expect(EmailAddress.create('  Ivan.Petrov@Mail.RU  ').getValue()).toBe(
      'ivan.petrov@mail.ru'
    );
  });

  it.each([
    ['no at sign', 'ivanmail.ru'],
    ['no domain', 'ivan@'],
    ['no local part', '@mail.ru'],
    ['no tld', 'ivan@mail'],
    ['spaces inside', 'iv an@mail.ru'],
    ['empty', ''],
    ['whitespace only', '   '],
    ['two at signs', 'ivan@ivan@mail.ru'],
  ])('rejects %s', (_label, raw) => {
    expect(() => EmailAddress.create(raw)).toThrow(
      UserDomainCodes.EMAIL_INVALID
    );
  });

  it('rejects an address longer than the maximum', () => {
    const tooLong = `${'a'.repeat(250)}@mail.ru`;

    expect(() => EmailAddress.create(tooLong)).toThrow(
      UserDomainCodes.EMAIL_INVALID
    );
  });

  it('compares by value, not identity', () => {
    const a = EmailAddress.create('ivan@mail.ru');
    const b = EmailAddress.create('IVAN@MAIL.RU');

    expect(a.equals(b)).toBe(true);
    expect(a.equals(EmailAddress.create('petr@mail.ru'))).toBe(false);
  });
});
