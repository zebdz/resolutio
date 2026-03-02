import { describe, it, expect, beforeEach } from 'vitest';
import { OtpCodeHasherImpl } from '../OtpCodeHasherImpl';

describe('OtpCodeHasherImpl', () => {
  let hasher: OtpCodeHasherImpl;

  beforeEach(() => {
    hasher = new OtpCodeHasherImpl('test-secret');
  });

  it('should produce a hash string', () => {
    const hash = hasher.hash('123456');
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe('123456');
  });

  it('should produce deterministic hashes', () => {
    const hash1 = hasher.hash('123456');
    const hash2 = hasher.hash('123456');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different codes', () => {
    const hash1 = hasher.hash('123456');
    const hash2 = hasher.hash('654321');
    expect(hash1).not.toBe(hash2);
  });

  it('should verify correct code', () => {
    const hash = hasher.hash('123456');
    expect(hasher.verify('123456', hash)).toBe(true);
  });

  it('should reject wrong code', () => {
    const hash = hasher.hash('123456');
    expect(hasher.verify('999999', hash)).toBe(false);
  });

  it('should produce different hashes with different secrets', () => {
    const hasher2 = new OtpCodeHasherImpl('other-secret');
    const hash1 = hasher.hash('123456');
    const hash2 = hasher2.hash('123456');
    expect(hash1).not.toBe(hash2);
  });
});
