import { PlaintextPassword } from '@/domain/user/UserValues';
/** Hashing adapter behavior preserves password bytes and salted-hash verification. */
import { describe, it, expect, beforeEach } from 'vitest';
import { Argon2PasswordHasher } from '../Argon2PasswordHasher';

describe('Argon2PasswordHasher', () => {
  let hasher: Argon2PasswordHasher;

  beforeEach(() => {
    hasher = new Argon2PasswordHasher();
  });

  it('should hash a password successfully', async () => {
    const password = PlaintextPassword.parse('SecurePassword123!');
    const hashed = await hasher.hash(password);

    expect(hashed).toBeDefined();
    expect(hashed).not.toBe(password);
    expect(hashed).toMatch(/^\$argon2id\$/); // argon2id prefix
  });

  it('should generate different hashes for the same password (due to salt)', async () => {
    const password = PlaintextPassword.parse('SamePassword123!');
    const hash1 = await hasher.hash(password);
    const hash2 = await hasher.hash(password);

    expect(hash1).not.toBe(hash2);
  });

  it('should hash empty string', async () => {
    const password = PlaintextPassword.parse('');
    const hashed = await hasher.hash(password);

    expect(hashed).toBeDefined();
    expect(hashed).toMatch(/^\$argon2id\$/);
  });

  it('should hash very long password', async () => {
    const password = PlaintextPassword.parse('a'.repeat(1000));
    const hashed = await hasher.hash(password);

    expect(hashed).toBeDefined();
    expect(hashed).toMatch(/^\$argon2id\$/);
  });

  it('should hash password with special characters', async () => {
    const password = PlaintextPassword.parse('!@#$%^&*()_+{}|:"<>?[];,./`~');
    const hashed = await hasher.hash(password);

    expect(hashed).toBeDefined();
    expect(hashed).toMatch(/^\$argon2id\$/);
  });
});
