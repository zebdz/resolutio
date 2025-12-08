import { describe, it, expect } from 'vitest';
import { PhoneNumber } from '../PhoneNumber';

describe('PhoneNumber', () => {
  describe('create', () => {
    it('should create a valid phone number', () => {
      const phone = PhoneNumber.create('+79161234567');
      expect(phone.getValue()).toBe('+79161234567');
    });

    it('should create a valid US phone number', () => {
      const phone = PhoneNumber.create('+14155551234');
      expect(phone.getValue()).toBe('+14155551234');
    });

    it('should throw error for invalid format without plus', () => {
      expect(() => PhoneNumber.create('79161234567')).toThrow('Invalid phone number format');
    });

    it('should throw error for invalid format with spaces', () => {
      expect(() => PhoneNumber.create('+7 916 123 45 67')).toThrow('Invalid phone number format');
    });

    it('should throw error for invalid format with dashes', () => {
      expect(() => PhoneNumber.create('+7-916-123-45-67')).toThrow('Invalid phone number format');
    });

    it('should throw error for phone number starting with 0', () => {
      expect(() => PhoneNumber.create('+09161234567')).toThrow('Invalid phone number format');
    });

    it('should throw error for empty string', () => {
      expect(() => PhoneNumber.create('')).toThrow('Invalid phone number format');
    });
  });

  describe('equals', () => {
    it('should return true for equal phone numbers', () => {
      const phone1 = PhoneNumber.create('+79161234567');
      const phone2 = PhoneNumber.create('+79161234567');
      expect(phone1.equals(phone2)).toBe(true);
    });

    it('should return false for different phone numbers', () => {
      const phone1 = PhoneNumber.create('+79161234567');
      const phone2 = PhoneNumber.create('+79161234568');
      expect(phone1.equals(phone2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return string representation', () => {
      const phone = PhoneNumber.create('+79161234567');
      expect(phone.toString()).toBe('+79161234567');
    });
  });
});
