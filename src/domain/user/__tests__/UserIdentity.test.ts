/** User persistence boundaries must reject malformed identity without inventing data. */
import { describe, expect, it } from 'vitest';
import { User } from '../User';
import { Nickname } from '../Nickname';
import { PhoneNumber } from '../PhoneNumber';
import { UserId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
import { FirstName, LastName, PasswordHash } from '../UserValues';
import { EmailAddress } from '../EmailAddress';
import { UserDomainCodes } from '../UserDomainCodes';
import { expectSuccess } from '../../shared/__tests__/resultAssertions';

describe('User identity', () => {
  const stored = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: PhoneNumber.create('+79161234567'),
    password: 'stored-password-hash',
    language: 'en' as const,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    nickname: Nickname.create('john_doe'),
  };
  it('rejects an empty persisted identity', () => {
    expect(() =>
      User.reconstitute({
        id: '',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: PhoneNumber.create('+79161234567'),
        password: 'stored-password-hash',
        language: 'en',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        nickname: Nickname.create('john_doe'),
      })
    ).toThrow();
  });

  it('does not bypass the existing name rules when loading persisted records', () => {
    expect(() => User.reconstitute({ ...stored, firstName: '123' })).toThrow();
  });

  it('rejects a non-boolean privacy choice instead of retaining a truthy string', () => {
    expect(() =>
      User.reconstitute({
        ...stored,
        // @ts-expect-error Exercise malformed storage data.
        allowFindByPhone: 'false',
      })
    ).toThrow();
    const user = User.reconstitute(stored);
    expect(() =>
      user.updatePrivacySettings({
        // @ts-expect-error Exercise an untyped client of the domain.
        allowFindByPhone: 'false',
      })
    ).toThrow();
    expect(user.allowFindByPhone).toBe(false);
  });

  it('requires a validated phone object when loading a user', () => {
    expect(() =>
      User.reconstitute({
        ...stored,
        // @ts-expect-error Primitive transport text has not become a PhoneNumber.
        phoneNumber: '+79161234567',
      })
    ).toThrow(UserDomainCodes.PHONE_NUMBER_INVALID);
  });

  it('cannot replace a validated nickname with a raw string', () => {
    const user = User.reconstitute(stored);
    // @ts-expect-error Untyped callers must not bypass value-object construction.
    expect(() => user.updateNickname('jane_doe')).toThrow(
      UserDomainCodes.NICKNAME_INVALID
    );
    expect(user.nickname).toBe(stored.nickname);
  });

  it('rejects an unvalidated address during rehydration and profile updates', () => {
    const address = { country: 'RU', city: '', street: '', building: '' };
    // @ts-expect-error A raw address is not a validated value object.
    expect(() => User.reconstitute({ ...stored, address })).toThrow();
    const user = User.reconstitute(stored);
    // @ts-expect-error A raw address is not a validated value object.
    expect(() => user.updateAddress(address)).toThrow();
    expect(user.address).toBeUndefined();
  });

  it('creates an identified user at the time supplied by the application', () => {
    const creation = {
      id: UserId.parse('user-generated-before-save'),
      now: Instant.parse('2026-10-26T10:30:00.123Z'),
    };
    const user = User.create(
      {
        firstName: FirstName.parse('John'),
        lastName: LastName.parse('Doe'),
        phoneNumber: stored.phoneNumber,
        password: PasswordHash.parse(stored.password),
        nickname: stored.nickname,
      },
      creation
    );

    expect(user.id).toBe(creation.id);
    expect(user.createdAt).toBe(creation.now);
  });

  it('requires the nickname present in the persisted record', () => {
    expect(() =>
      User.reconstitute({
        ...stored,
        // @ts-expect-error Exercise corrupted external persistence input.
        nickname: undefined,
      })
    ).toThrow('domain.user.nicknameInvalid');
  });

  it('creates email contact unconfirmed even when a wider input record includes confirmation', () => {
    const now = Instant.parse('2026-10-26T10:30:00.123Z');
    const props = {
      firstName: FirstName.parse('John'),
      lastName: LastName.parse('Doe'),
      phoneNumber: stored.phoneNumber,
      password: PasswordHash.parse(stored.password),
      nickname: stored.nickname,
      email: EmailAddress.create('john@example.com'),
      emailConfirmedAt: now,
    };
    const user = User.create(props, { id: UserId.parse('user-2'), now });

    expect(user.hasConfirmedEmail()).toBe(false);
  });

  it('copies persisted Date input into an immutable instant', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const user = User.reconstitute({ ...stored, createdAt });
    createdAt.setFullYear(2030);

    expect(user.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('cannot confirm an absent email through a transition or persistence input', () => {
    const now = Instant.parse('2026-10-30T12:00:00.000Z');
    const user = User.reconstitute(stored);
    expect(user.confirmEmail(now)).toEqual({
      success: false,
      error: UserDomainCodes.EMAIL_NOT_SET,
    });
    expect(user.email).toBeUndefined();
    expect(user.emailConfirmedAt).toBeUndefined();
    expect(() =>
      User.reconstitute({ ...stored, emailConfirmedAt: now })
    ).toThrow(UserDomainCodes.EMAIL_NOT_SET);
  });

  it('preserves immutable email alternatives and address-specific confirmation', () => {
    const now = Instant.parse('2026-10-30T12:00:00.000Z');
    const absent = User.reconstitute(stored);
    const address = EmailAddress.create('john@example.com');
    const unconfirmed = absent.changeEmail(address);
    const confirmed = expectSuccess(unconfirmed.confirmEmail(now));
    expect(absent.emailState).toEqual({ kind: 'absent' });
    expect(unconfirmed.emailState).toEqual({ kind: 'unconfirmed', address });
    expect(confirmed.emailState).toEqual({
      kind: 'confirmed',
      address,
      confirmedAt: now,
    });
    expect(Object.isFrozen(confirmed.emailState)).toBe(true);
    expect(confirmed.changeEmail(address).emailState.kind).toBe('unconfirmed');
    expect(confirmed.removeEmail().emailState).toEqual({ kind: 'absent' });
    expect(
      User.reconstitute({ ...stored, email: address, emailConfirmedAt: now })
        .emailState
    ).toEqual(confirmed.emailState);
  });

  it('keeps identity stable when registration receives a wider record', () => {
    const user = User.reconstitute(stored);
    const details = {
      id: UserId.parse('another-user'),
      firstName: FirstName.parse('Jane'),
      lastName: LastName.parse('Doe'),
      phoneNumber: stored.phoneNumber,
      password: PasswordHash.parse(stored.password),
    };
    const updated = user.updateRegistrationDetails(
      details,
      Instant.parse('2026-10-26T10:30:00.123Z')
    );

    expect(updated.id).toBe(user.id);
    expect(updated.firstName).toBe('Jane');
  });

  it.each([new Date(NaN), new Date('+010000-01-01T00:00:00.000Z')])(
    'rejects an invalid or unrepresentable persisted instant: %s',
    (createdAt) => {
      expect(() => User.reconstitute({ ...stored, createdAt })).toThrow();
    }
  );
});
