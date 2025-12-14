import { describe, it, expect } from 'vitest';
import { User } from '../User';
import { PhoneNumber } from '../PhoneNumber';

describe('User', () => {
  const validProps = {
    firstName: 'John',
    lastName: 'Doe',
    middleName: 'Smith',
    phoneNumber: PhoneNumber.create('+79161234567'),
    password: 'hashedpassword123',
  };

  describe('create', () => {
    it('should create a user with valid props', () => {
      const user = User.create(validProps);

      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
      expect(user.middleName).toBe('Smith');
      expect(user.phoneNumber.getValue()).toBe('+79161234567');
      expect(user.password).toBe('hashedpassword123');
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should create a user without middle name', () => {
      const { middleName, ...propsWithoutMiddleName } = validProps;
      const user = User.create(propsWithoutMiddleName);

      expect(user.middleName).toBeUndefined();
    });

    it('should throw error when firstName is empty', () => {
      const props = { ...validProps, firstName: '' };
      expect(() => User.create(props)).toThrow('First name is required');
    });

    it('should throw error when firstName is only whitespace', () => {
      const props = { ...validProps, firstName: '   ' };
      expect(() => User.create(props)).toThrow('First name is required');
    });

    it('should throw error when lastName is empty', () => {
      const props = { ...validProps, lastName: '' };
      expect(() => User.create(props)).toThrow('Last name is required');
    });

    it('should throw error when password is empty', () => {
      const props = { ...validProps, password: '' };
      expect(() => User.create(props)).toThrow('Password is required');
    });

    it('should throw error when language is invalid', () => {
      const props = { ...validProps, language: 'invalid' };
      // @ts-expect-error - Testing invalid language value
      expect(() => User.create(props)).toThrow('Language must be one of:');
    });

    it('should create user with default language if not provided', () => {
      const user = User.create(validProps);
      expect(user.language).toBe('ru');
    });

    it('should create user with specified language', () => {
      const user = User.create({ ...validProps, language: 'ru' });
      expect(user.language).toBe('ru');
    });
  });

  describe('getFullName', () => {
    it('should return full name with middle name', () => {
      const user = User.create(validProps);
      expect(user.getFullName()).toBe('John Smith Doe');
    });

    it('should return full name without middle name', () => {
      const { middleName, ...propsWithoutMiddleName } = validProps;
      const user = User.create(propsWithoutMiddleName);
      expect(user.getFullName()).toBe('John Doe');
    });
  });

  describe('canAuthenticate', () => {
    it('should return true for user with password and phone', () => {
      const user = User.create(validProps);
      expect(user.canAuthenticate()).toBe(true);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a user from persistence', () => {
      const props = {
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: PhoneNumber.create('+79161234567'),
        password: 'hashedpassword123',
        language: 'en' as const,
        createdAt: new Date('2024-01-01'),
      };

      const user = User.reconstitute(props);

      expect(user.id).toBe('user-123');
      expect(user.firstName).toBe('John');
      expect(user.language).toBe('en');
      expect(user.createdAt).toEqual(new Date('2024-01-01'));
    });
  });

  describe('updateLanguage', () => {
    it('should update language to a valid value', () => {
      const user = User.create(validProps);
      const updatedUser = user.updateLanguage('ru');

      expect(updatedUser.language).toBe('ru');
      expect(updatedUser.id).toBe(user.id);
      expect(updatedUser.firstName).toBe(user.firstName);
    });

    it('should throw error when updating to invalid language', () => {
      const user = User.create(validProps);
      expect(() => user.updateLanguage('invalid')).toThrow(
        'Language must be one of:'
      );
    });
  });

  describe('updateMiddleName', () => {
    it('should update middle name', () => {
      const user = User.create(validProps);
      const updatedUser = user.updateMiddleName('NewMiddle');

      expect(updatedUser.middleName).toBe('NewMiddle');
      expect(updatedUser.id).toBe(user.id);
    });

    it('should allow clearing middle name', () => {
      const user = User.create(validProps);
      const updatedUser = user.updateMiddleName(undefined);

      expect(updatedUser.middleName).toBeUndefined();
    });
  });
});
