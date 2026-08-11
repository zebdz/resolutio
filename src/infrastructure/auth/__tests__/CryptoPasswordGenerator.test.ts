import { describe, it, expect } from 'vitest';
import { CryptoPasswordGenerator } from '../CryptoPasswordGenerator';
import {
  PASSWORD_MIN_LENGTH,
  passwordMatchesPersonalInfo,
} from '@/domain/user/User';

describe('CryptoPasswordGenerator', () => {
  const generator = new CryptoPasswordGenerator();
  const samples = Array.from({ length: 200 }, () => generator.generate());

  it('generates 4 groups of 4 characters', () => {
    for (const password of samples) {
      expect(password).toMatch(/^[a-zA-Z2-9]{4}(-[a-zA-Z2-9]{4}){3}$/);
    }
  });

  it('clears the registration minimum length', () => {
    for (const password of samples) {
      expect(password.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
    }
  });

  it('always includes a lowercase, an uppercase and a digit', () => {
    for (const password of samples) {
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
    }
  });

  it('avoids glyphs that are misread when the password is retyped', () => {
    for (const password of samples) {
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });

  it('does not repeat itself', () => {
    expect(new Set(samples).size).toBe(samples.length);
  });

  it('cannot collide with the user personal-info rules', () => {
    for (const password of samples) {
      expect(
        passwordMatchesPersonalInfo(password, {
          firstName: 'Ivan',
          lastName: 'Ivanov',
          phoneNumber: '+79161234567',
        })
      ).toBe(false);
    }
  });
});
