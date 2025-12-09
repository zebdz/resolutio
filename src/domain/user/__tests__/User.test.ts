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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  });

  describe('getFullName', () => {
    it('should return full name with middle name', () => {
      const user = User.create(validProps);
      expect(user.getFullName()).toBe('John Smith Doe');
    });

    it('should return full name without middle name', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        createdAt: new Date('2024-01-01'),
      };

      const user = User.reconstitute(props);

      expect(user.id).toBe('user-123');
      expect(user.firstName).toBe('John');
      expect(user.createdAt).toEqual(new Date('2024-01-01'));
    });
  });
});
