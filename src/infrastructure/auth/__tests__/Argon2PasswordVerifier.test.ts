/** Hashing adapter behavior preserves password bytes and salted-hash verification. */
import { PasswordHash, PlaintextPassword } from '@/domain/user/UserValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { Argon2PasswordVerifier } from '../Argon2PasswordVerifier';
import { Argon2PasswordHasher } from '../Argon2PasswordHasher';

describe('Argon2PasswordVerifier', () => {
  let verifier: Argon2PasswordVerifier;
  let hasher: Argon2PasswordHasher;

  beforeEach(() => {
    verifier = new Argon2PasswordVerifier();
    hasher = new Argon2PasswordHasher();
  });

  it('should verify correct password', async () => {
    const password = PlaintextPassword.parse('CorrectPassword123!');
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify(password, hashed);

    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = PlaintextPassword.parse('CorrectPassword123!');
    const wrongPassword = PlaintextPassword.parse('WrongPassword123!');
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify(wrongPassword, hashed);

    expect(isValid).toBe(false);
  });

  it('should reject password with different case', async () => {
    const password = PlaintextPassword.parse('Password123!');
    const wrongCase = PlaintextPassword.parse('password123!');
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify(wrongCase, hashed);

    expect(isValid).toBe(false);
  });

  it('should reject empty password when hash is not empty', async () => {
    const password = PlaintextPassword.parse('Password123!');
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify(PlaintextPassword.parse(''), hashed);

    expect(isValid).toBe(false);
  });

  it('should verify empty password correctly', async () => {
    const password = PlaintextPassword.parse('');
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify(password, hashed);

    expect(isValid).toBe(true);
  });

  it('should handle invalid hash format gracefully', async () => {
    const invalidHash = PasswordHash.parse('not-a-valid-argon2-hash');
    const password = PlaintextPassword.parse('SomePassword123!');

    const isValid = await verifier.verify(password, invalidHash);

    expect(isValid).toBe(false);
  });

  it('should verify password with special characters', async () => {
    const password = PlaintextPassword.parse('!@#$%^&*()_+{}|:"<>?[];,./`~');
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify(password, hashed);

    expect(isValid).toBe(true);
  });

  it('should verify very long password', async () => {
    const password = PlaintextPassword.parse('a'.repeat(500));
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify(password, hashed);

    expect(isValid).toBe(true);
  });
});

it('upgrades a tagged Laravel credential only when the account still owns that hash', async () => {
  const { UserId } = await import('@/domain/shared/EntityIds');
  const id = UserId.parse('legacy-fixture');
  const password = PlaintextPassword.parse('Legacy-demo-42');
  const legacy = PasswordHash.parse(
    'bcrypt:$2y$04$Ay.KDWajH.pDJkC.WFn.KeOlN7b/NxY3XGFvPeRBGWEF9B8rSmfk2'
  );
  let stored = legacy;
  const verifier = new Argon2PasswordVerifier(
    async (userId, expected, replacement) => {
      if (userId !== id || stored !== expected) {
        return false;
      }

      stored = replacement;

      return true;
    }
  );
  expect(
    await verifier.verify(PlaintextPassword.parse('incorrect'), legacy, id)
  ).toBe(false);
  expect(stored).toBe(legacy);
  expect(await verifier.verify(password, legacy, id)).toBe(true);
  expect(stored.startsWith('$argon2id$')).toBe(true);
  expect(await verifier.verify(password, stored, id)).toBe(true);
  expect(await verifier.verify(password, legacy, id)).toBe(false);
});
