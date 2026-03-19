import { describe, it, expect } from 'vitest';
import { Nickname } from '../Nickname';
import { UserDomainCodes } from '../UserDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

describe('Nickname', () => {
  describe('create', () => {
    it('should create a valid nickname', () => {
      const nickname = Nickname.create('john_doe');
      expect(nickname.getValue()).toBe('john_doe');
    });

    it('should allow alphanumeric characters', () => {
      const nickname = Nickname.create('user123');
      expect(nickname.getValue()).toBe('user123');
    });

    it('should reject dots', () => {
      expect(() => Nickname.create('john.doe')).toThrow();
    });

    it('should allow underscores', () => {
      const nickname = Nickname.create('john_doe_1');
      expect(nickname.getValue()).toBe('john_doe_1');
    });

    it('should require starting with a letter', () => {
      expect(() => Nickname.create('1user')).toThrow();
      expect(() => Nickname.create('_user')).toThrow();
      const nickname = Nickname.create('aUser');
      expect(nickname.getValue()).toBe('aUser');
    });

    it('should reject ending with underscore', () => {
      expect(() => Nickname.create('john_')).toThrow();
      expect(() => Nickname.create('john_doe_')).toThrow();
    });

    it('should throw for nickname shorter than min length', () => {
      expect(() => Nickname.create('ab')).toThrow();
      expect(() => Nickname.create('abcd')).toThrow();
    });

    it('should throw for nickname longer than max length', () => {
      expect(() => Nickname.create('a'.repeat(31))).toThrow();
    });

    it('should throw for consecutive underscores', () => {
      expect(() => Nickname.create('john__doe')).toThrow();
    });

    it('should throw for special characters', () => {
      expect(() => Nickname.create('john@doe')).toThrow();
      expect(() => Nickname.create('john doe')).toThrow();
      expect(() => Nickname.create('john-doe')).toThrow();
    });

    it('should throw for empty string', () => {
      expect(() => Nickname.create('')).toThrow();
    });

    describe('profanity checks', () => {
      const profaneChecker: ProfanityChecker = {
        containsProfanity: (text: string) =>
          text.toLowerCase().includes('badword'),
      };

      it('should throw when nickname contains profanity', () => {
        expect(() => Nickname.create('badword123', profaneChecker)).toThrow(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should not throw when nickname is clean', () => {
        const nickname = Nickname.create('clean_nick', profaneChecker);
        expect(nickname.getValue()).toBe('clean_nick');
      });

      it('should not check profanity when checker is not provided', () => {
        const nickname = Nickname.create('john_doe');
        expect(nickname.getValue()).toBe('john_doe');
      });
    });

    it('should throw domain code, not hardcoded English', () => {
      const cases = [
        '', // empty
        'ab', // too short
        'a'.repeat(31), // too long
        '1user', // starts with digit
        'john_', // ends with underscore
        'john__doe', // consecutive underscores
        'john@doe', // special chars
      ];

      for (const input of cases) {
        expect(() => Nickname.create(input)).toThrow(
          UserDomainCodes.NICKNAME_INVALID
        );
      }
    });
  });

  describe('generate', () => {
    it('should generate a nickname starting with user_', () => {
      const nickname = Nickname.generate();
      expect(nickname.getValue()).toMatch(/^user_[a-z0-9]{8}$/);
    });

    it('should generate unique nicknames', () => {
      const nicknames = new Set<string>();

      for (let i = 0; i < 100; i++) {
        nicknames.add(Nickname.generate().getValue());
      }

      expect(nicknames.size).toBe(100);
    });
  });

  describe('equals', () => {
    it('should return true for equal nicknames', () => {
      const a = Nickname.create('john_doe');
      const b = Nickname.create('john_doe');
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different nicknames', () => {
      const a = Nickname.create('john_doe');
      const b = Nickname.create('jane_doe');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the nickname value', () => {
      const nickname = Nickname.create('john_doe');
      expect(nickname.toString()).toBe('john_doe');
    });
  });
});
