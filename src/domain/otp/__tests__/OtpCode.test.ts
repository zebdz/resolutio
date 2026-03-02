import { describe, it, expect } from 'vitest';
import { OtpCode } from '../OtpCode';

describe('OtpCode', () => {
  describe('generate', () => {
    it('should generate a 6-digit string', () => {
      const code = OtpCode.generate();
      expect(code.getValue()).toMatch(/^\d{6}$/);
    });

    it('should generate different codes on subsequent calls', () => {
      const codes = new Set<string>();

      for (let i = 0; i < 20; i++) {
        codes.add(OtpCode.generate().getValue());
      }

      // With 20 random 6-digit codes, duplicates are extremely unlikely
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe('fromString', () => {
    it('should create from valid 6-digit string', () => {
      const code = OtpCode.fromString('123456');
      expect(code.getValue()).toBe('123456');
    });

    it('should reject non-numeric string', () => {
      expect(() => OtpCode.fromString('abcdef')).toThrow();
    });

    it('should reject 5-digit string', () => {
      expect(() => OtpCode.fromString('12345')).toThrow();
    });

    it('should reject 7-digit string', () => {
      expect(() => OtpCode.fromString('1234567')).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => OtpCode.fromString('')).toThrow();
    });

    it('should reject string with spaces', () => {
      expect(() => OtpCode.fromString('12 456')).toThrow();
    });
  });

  describe('equals', () => {
    it('should return true for equal codes', () => {
      const a = OtpCode.fromString('123456');
      const b = OtpCode.fromString('123456');
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different codes', () => {
      const a = OtpCode.fromString('123456');
      const b = OtpCode.fromString('654321');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the code string', () => {
      const code = OtpCode.fromString('999999');
      expect(code.toString()).toBe('999999');
    });
  });
});
