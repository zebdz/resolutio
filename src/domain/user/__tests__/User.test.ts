import { describe, it, expect } from 'vitest';
import {
  User,
  NAME_MAX_LENGTH,
  NAME_REGEX,
  passwordMatchesPersonalInfo,
} from '../User';
import { PhoneNumber } from '../PhoneNumber';
import { Nickname } from '../Nickname';
import { UserDomainCodes } from '../UserDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';
import { Address } from '../Address';

describe('User', () => {
  const validProps = {
    firstName: 'John',
    lastName: 'Doe',
    middleName: 'Smith',
    phoneNumber: PhoneNumber.create('+79161234567'),
    password: 'hashedpassword123',
    nickname: Nickname.generate(),
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

    it('should create user with consentGivenAt', () => {
      const consentDate = new Date('2026-03-03');
      const user = User.create({ ...validProps, consentGivenAt: consentDate });
      expect(user.consentGivenAt).toEqual(consentDate);
    });

    it('should create user without consentGivenAt', () => {
      const user = User.create(validProps);
      expect(user.consentGivenAt).toBeUndefined();
    });

    describe('name validation', () => {
      // Valid names
      it.each([
        ['Иван', 'Cyrillic'],
        ['John', 'Latin'],
        ["O'Brien", 'straight apostrophe'],
        ['O\u2019Brien', 'curly apostrophe'],
        ['Анна-Мария', 'hyphenated Cyrillic'],
        ['Иванович', 'Cyrillic patronymic'],
        ['Ёлкин', 'starts with Ё'],
        ['Ab', 'minimum 2 chars'],
      ])('should accept valid firstName: %s (%s)', (name) => {
        const user = User.create({ ...validProps, firstName: name });
        expect(user.firstName).toBe(name);
      });

      it.each([
        ['Иван', 'Cyrillic'],
        ['John', 'Latin'],
        ["O'Brien", 'straight apostrophe'],
        ['Анна-Мария', 'hyphenated'],
      ])('should accept valid lastName: %s (%s)', (name) => {
        const user = User.create({ ...validProps, lastName: name });
        expect(user.lastName).toBe(name);
      });

      // Invalid names — firstName
      it.each([
        ['123', 'digits only'],
        ['john', 'lowercase start'],
        ['Иван123', 'contains digits'],
        ['J', 'single char — too short'],
        ['Иван Петрович', 'contains space'],
        ['a'.repeat(51), 'exceeds max length'],
      ])('should reject invalid firstName: %s (%s)', (name) => {
        expect(() => User.create({ ...validProps, firstName: name })).toThrow(
          UserDomainCodes.FIRST_NAME_INVALID
        );
      });

      // Invalid names — lastName
      it.each([
        ['123', 'digits only'],
        ['doe', 'lowercase start'],
        ['D', 'single char'],
      ])('should reject invalid lastName: %s (%s)', (name) => {
        expect(() => User.create({ ...validProps, lastName: name })).toThrow(
          UserDomainCodes.LAST_NAME_INVALID
        );
      });

      // MiddleName — valid when provided
      it.each([
        ['Иванович', 'Cyrillic patronymic'],
        ['James', 'Latin'],
        ["O'Connor", 'with apostrophe'],
      ])('should accept valid middleName: %s (%s)', (name) => {
        const user = User.create({ ...validProps, middleName: name });
        expect(user.middleName).toBe(name);
      });

      // MiddleName — invalid when provided
      it.each([
        ['123', 'digits only'],
        ['james', 'lowercase start'],
        ['J', 'single char'],
      ])('should reject invalid middleName: %s (%s)', (name) => {
        expect(() => User.create({ ...validProps, middleName: name })).toThrow(
          UserDomainCodes.MIDDLE_NAME_INVALID
        );
      });

      // MiddleName — skipped when undefined
      it('should skip middleName validation when undefined', () => {
        const { middleName, ...propsWithoutMiddle } = validProps;
        const user = User.create(propsWithoutMiddle);
        expect(user.middleName).toBeUndefined();
      });

      // Constants exported
      it('should export NAME_MAX_LENGTH as 50', () => {
        expect(NAME_MAX_LENGTH).toBe(50);
      });

      it('should export NAME_REGEX', () => {
        expect(NAME_REGEX).toBeInstanceOf(RegExp);
      });
    });

    describe('profanity checks', () => {
      const profaneChecker: ProfanityChecker = {
        containsProfanity: (text: string) =>
          text.toLowerCase().includes('badword'),
      };

      it('should throw when firstName contains profanity', () => {
        const props = { ...validProps, firstName: 'Badword' };
        expect(() => User.create(props, profaneChecker)).toThrow(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should throw when lastName contains profanity', () => {
        const props = { ...validProps, lastName: 'Badword' };
        expect(() => User.create(props, profaneChecker)).toThrow(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should throw when middleName contains profanity', () => {
        const props = { ...validProps, middleName: 'Badword' };
        expect(() => User.create(props, profaneChecker)).toThrow(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should not throw when middleName is undefined', () => {
        const { middleName, ...propsNoMiddle } = validProps;
        expect(() => User.create(propsNoMiddle, profaneChecker)).not.toThrow();
      });

      it('should not check profanity when checker is not provided', () => {
        const user = User.create(validProps);
        expect(user.firstName).toBe('John');
      });
    });
  });

  describe('getFullName', () => {
    it('should return full name with middle name in lastName firstName middleName order', () => {
      const user = User.create(validProps);
      expect(user.getFullName()).toBe('Doe John Smith');
    });

    it('should return full name without middle name in lastName firstName order', () => {
      const { middleName, ...propsWithoutMiddleName } = validProps;
      const user = User.create(propsWithoutMiddleName);
      expect(user.getFullName()).toBe('Doe John');
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

    it('should reconstitute a user with consentGivenAt', () => {
      const consentDate = new Date('2026-01-15');
      const props = {
        id: 'user-456',
        firstName: 'Jane',
        lastName: 'Doe',
        phoneNumber: PhoneNumber.create('+79161234567'),
        password: 'hashedpassword123',
        language: 'ru' as const,
        createdAt: new Date('2024-01-01'),
        consentGivenAt: consentDate,
      };

      const user = User.reconstitute(props);

      expect(user.consentGivenAt).toEqual(consentDate);
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

    it('should throw when middleName contains profanity', () => {
      const checker: ProfanityChecker = {
        containsProfanity: (text: string) =>
          text.toLowerCase().includes('badword'),
      };
      const user = User.create(validProps);
      expect(() => user.updateMiddleName('Badword', checker)).toThrow(
        SharedDomainCodes.CONTAINS_PROFANITY
      );
    });

    it('should not throw when middleName is undefined with checker', () => {
      const checker: ProfanityChecker = {
        containsProfanity: () => true,
      };
      const user = User.create(validProps);
      const updated = user.updateMiddleName(undefined, checker);
      expect(updated.middleName).toBeUndefined();
    });

    it('should not check profanity when checker is not provided', () => {
      const user = User.create(validProps);
      const updated = user.updateMiddleName('AnyName');
      expect(updated.middleName).toBe('AnyName');
    });
  });

  describe('privacy settings', () => {
    it('should create user with default privacy settings (both false)', () => {
      const user = User.create(validProps);
      expect(user.allowFindByName).toBe(false);
      expect(user.allowFindByPhone).toBe(false);
      expect(user.privacySetupCompleted).toBe(false);
    });

    it('should create user with a nickname', () => {
      const user = User.create(validProps);
      expect(user.nickname).toBeDefined();
      expect(user.nickname.getValue()).toMatch(/^user_[a-z0-9]{8}$/);
    });

    it('should reconstitute user with privacy settings', () => {
      const nickname = Nickname.create('john_doe');
      const props = {
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: PhoneNumber.create('+79161234567'),
        password: 'hashedpassword123',
        language: 'en' as const,
        createdAt: new Date('2024-01-01'),
        nickname,
        allowFindByName: true,
        allowFindByPhone: false,
        privacySetupCompleted: true,
      };

      const user = User.reconstitute(props);

      expect(user.nickname.getValue()).toBe('john_doe');
      expect(user.allowFindByName).toBe(true);
      expect(user.allowFindByPhone).toBe(false);
      expect(user.privacySetupCompleted).toBe(true);
    });

    it('should update privacy settings', () => {
      const user = User.create(validProps);
      const updated = user.updatePrivacySettings({
        allowFindByName: true,
        allowFindByPhone: true,
      });

      expect(updated.allowFindByName).toBe(true);
      expect(updated.allowFindByPhone).toBe(true);
      // Other props preserved
      expect(updated.firstName).toBe(user.firstName);
    });

    it('should partially update privacy settings', () => {
      const user = User.create(validProps);
      const updated = user.updatePrivacySettings({
        allowFindByName: true,
      });

      expect(updated.allowFindByName).toBe(true);
      expect(updated.allowFindByPhone).toBe(false); // unchanged
    });

    it('should update nickname', () => {
      const user = User.create(validProps);
      const newNickname = Nickname.create('new_nick');
      const updated = user.updateNickname(newNickname);

      expect(updated.nickname.getValue()).toBe('new_nick');
      expect(updated.firstName).toBe(user.firstName);
    });

    it('should complete privacy setup', () => {
      const user = User.create(validProps);
      expect(user.privacySetupCompleted).toBe(false);

      const updated = user.completePrivacySetup();
      expect(updated.privacySetupCompleted).toBe(true);
    });

    it('should create user with default allowFindByAddress (false)', () => {
      const user = User.create(validProps);
      expect(user.allowFindByAddress).toBe(false);
    });

    it('should reconstitute user with allowFindByAddress', () => {
      const user = User.reconstitute({
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: PhoneNumber.create('+79161234567'),
        password: 'hashedpassword123',
        language: 'en' as const,
        createdAt: new Date('2024-01-01'),
        allowFindByAddress: true,
      });
      expect(user.allowFindByAddress).toBe(true);
    });

    it('should update allowFindByAddress via updatePrivacySettings', () => {
      const user = User.create(validProps);
      const updated = user.updatePrivacySettings({
        allowFindByAddress: true,
      });
      expect(updated.allowFindByAddress).toBe(true);
      expect(updated.allowFindByName).toBe(false); // unchanged
    });

    it('should preserve allowFindByAddress when not provided', () => {
      const user = User.reconstitute({
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: PhoneNumber.create('+79161234567'),
        password: 'hashedpassword123',
        language: 'en' as const,
        createdAt: new Date('2024-01-01'),
        allowFindByAddress: true,
      });
      const updated = user.updatePrivacySettings({ allowFindByName: true });
      expect(updated.allowFindByAddress).toBe(true);
    });
  });

  describe('address', () => {
    it('should create user with no address', () => {
      const user = User.create(validProps);
      expect(user.address).toBeUndefined();
    });

    it('should reconstitute user with address', () => {
      const address = Address.create({
        country: 'Russia',
        city: 'Moscow',
        street: 'Tverskaya',
        building: '12',
      });
      const user = User.reconstitute({
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: PhoneNumber.create('+79161234567'),
        password: 'hashedpassword123',
        language: 'en' as const,
        createdAt: new Date('2024-01-01'),
        address,
      });
      expect(user.address).toBeDefined();
      expect(user.address!.city).toBe('Moscow');
    });

    it('should update address', () => {
      const user = User.create(validProps);
      const address = Address.create({
        country: 'Russia',
        city: 'Moscow',
        street: 'Tverskaya',
        building: '12',
      });
      const updated = user.updateAddress(address);
      expect(updated.address).toBeDefined();
      expect(updated.address!.street).toBe('Tverskaya');
      // original unchanged
      expect(user.address).toBeUndefined();
    });

    it('should clear address with undefined', () => {
      const address = Address.create({
        country: 'Russia',
        city: 'Moscow',
        street: 'Tverskaya',
        building: '12',
      });
      const user = User.reconstitute({
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: PhoneNumber.create('+79161234567'),
        password: 'hashedpassword123',
        language: 'en' as const,
        createdAt: new Date('2024-01-01'),
        address,
      });
      const updated = user.updateAddress(undefined);
      expect(updated.address).toBeUndefined();
    });
  });

  describe('isConfirmed', () => {
    it('should return false when confirmedAt is not set', () => {
      const user = User.create(validProps);
      expect(user.isConfirmed()).toBe(false);
    });

    it('should return true when confirmedAt is set', () => {
      const user = User.reconstitute({
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: PhoneNumber.create('+79161234567'),
        password: 'hashedpassword123',
        language: 'ru' as const,
        createdAt: new Date('2024-01-01'),
        confirmedAt: new Date('2024-01-02'),
      });
      expect(user.isConfirmed()).toBe(true);
    });
  });

  describe('confirm', () => {
    it('should return new user with confirmedAt set', () => {
      const user = User.create(validProps);
      expect(user.isConfirmed()).toBe(false);

      const confirmed = user.confirm();
      expect(confirmed.isConfirmed()).toBe(true);
      expect(confirmed.confirmedAt).toBeInstanceOf(Date);
      // Original unchanged
      expect(user.isConfirmed()).toBe(false);
    });

    it('should preserve all other props', () => {
      const user = User.create(validProps);
      const confirmed = user.confirm();

      expect(confirmed.firstName).toBe(user.firstName);
      expect(confirmed.lastName).toBe(user.lastName);
      expect(confirmed.phoneNumber.getValue()).toBe(
        user.phoneNumber.getValue()
      );
    });
  });

  describe('passwordMatchesPersonalInfo', () => {
    it('should return true when password equals firstName (case-insensitive)', () => {
      expect(passwordMatchesPersonalInfo('John', { firstName: 'john' })).toBe(
        true
      );
      expect(passwordMatchesPersonalInfo('john', { firstName: 'John' })).toBe(
        true
      );
    });

    it('should return true when password equals lastName (case-insensitive)', () => {
      expect(passwordMatchesPersonalInfo('Doe', { lastName: 'doe' })).toBe(
        true
      );
    });

    it('should return true when password equals middleName (case-insensitive)', () => {
      expect(
        passwordMatchesPersonalInfo('Smith', { middleName: 'smith' })
      ).toBe(true);
    });

    it('should return true when password equals phoneNumber (exact)', () => {
      expect(
        passwordMatchesPersonalInfo('+79161234567', {
          phoneNumber: '+79161234567',
        })
      ).toBe(true);
    });

    it('should return true when password is phone digits without +', () => {
      expect(
        passwordMatchesPersonalInfo('79161234567', {
          phoneNumber: '+79161234567',
        })
      ).toBe(true);
    });

    it('should return true when password contains >=90% consecutive phone digits', () => {
      // 10 of 11 digits = ~91%
      expect(
        passwordMatchesPersonalInfo('7916123456', {
          phoneNumber: '+79161234567',
        })
      ).toBe(true);
    });

    it('should return false when password contains <90% consecutive phone digits', () => {
      // 9 of 11 digits = ~82%
      expect(
        passwordMatchesPersonalInfo('791612345', {
          phoneNumber: '+79161234567',
        })
      ).toBe(false);
    });

    it('should return false when phone digits appear but not consecutively', () => {
      expect(
        passwordMatchesPersonalInfo('7916X1234567', {
          phoneNumber: '+79161234567',
        })
      ).toBe(false);
    });

    it('should return false when no match', () => {
      expect(
        passwordMatchesPersonalInfo('SecurePass123', {
          firstName: 'John',
          lastName: 'Doe',
          middleName: 'Smith',
          phoneNumber: '+79161234567',
        })
      ).toBe(false);
    });

    it('should return false when optional fields undefined', () => {
      expect(passwordMatchesPersonalInfo('SomePass', {})).toBe(false);
    });

    it('should return false for empty password', () => {
      expect(passwordMatchesPersonalInfo('', { firstName: 'John' })).toBe(
        false
      );
    });
  });
});
