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
    const password = 'CorrectPassword123!';
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify(password, hashed);

    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'CorrectPassword123!';
    const wrongPassword = 'WrongPassword123!';
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify(wrongPassword, hashed);

    expect(isValid).toBe(false);
  });

  it('should reject password with different case', async () => {
    const password = 'Password123!';
    const wrongCase = 'password123!';
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify(wrongCase, hashed);

    expect(isValid).toBe(false);
  });

  it('should reject empty password when hash is not empty', async () => {
    const password = 'Password123!';
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify('', hashed);

    expect(isValid).toBe(false);
  });

  it('should verify empty password correctly', async () => {
    const password = '';
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify(password, hashed);

    expect(isValid).toBe(true);
  });

  it('should handle invalid hash format gracefully', async () => {
    const invalidHash = 'not-a-valid-argon2-hash';
    const password = 'SomePassword123!';

    const isValid = await verifier.verify(password, invalidHash);

    expect(isValid).toBe(false);
  });

  it('should verify password with special characters', async () => {
    const password = '!@#$%^&*()_+{}|:"<>?[];,./`~';
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify(password, hashed);

    expect(isValid).toBe(true);
  });

  it('should verify very long password', async () => {
    const password = 'a'.repeat(500);
    const hashed = await hasher.hash(password);

    const isValid = await verifier.verify(password, hashed);

    expect(isValid).toBe(true);
  });
});
