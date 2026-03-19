import { describe, it, expect } from 'vitest';
import { UpdateUserProfileSchema } from '@/src/application/user/UpdateUserProfileSchema';
import { CompletePrivacySetupSchema } from '@/src/application/user/CompletePrivacySetupSchema';
import { RegisterUserSchema } from '@/application/auth/RegisterUserSchema';
import { LoginUserSchema } from '@/application/auth/LoginUserSchema';
import { createOrganizationSchema } from '@/application/organization/CreateOrganizationSchema';
import { ProfanityChecker } from '@/domain/shared/profanity/ProfanityChecker';
import { CreateBoardSchema } from '@/application/board/CreateBoardSchema';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { OrganizationDomainCodes } from '@/domain/organization/OrganizationDomainCodes';
import { BoardDomainCodes } from '@/domain/board/BoardDomainCodes';

const noopProfanityChecker: ProfanityChecker = {
  containsProfanity: () => false,
};
const CreateOrganizationSchema = createOrganizationSchema(noopProfanityChecker);

/**
 * These tests verify that Zod schemas produce domain codes (not hardcoded English strings)
 * for user-facing validation errors. Domain codes start with "domain." and are translated
 * via next-intl at runtime.
 */

function getFieldError(
  result: {
    success: false;
    error: { issues: Array<{ path: (string | number)[]; message: string }> };
  },
  field: string
): string | undefined {
  return result.error.issues.find((i) => i.path.join('.') === field)?.message;
}

describe('Schema domain codes — user schemas', () => {
  it('UpdateUserProfileSchema: nickname too short → domain code', () => {
    const result = UpdateUserProfileSchema.safeParse({
      userId: 'test',
      nickname: 'ab',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'nickname');
      expect(msg).toBe(UserDomainCodes.NICKNAME_INVALID);
    }
  });

  it('UpdateUserProfileSchema: nickname too long → domain code', () => {
    const result = UpdateUserProfileSchema.safeParse({
      userId: 'test',
      nickname: 'a'.repeat(31),
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'nickname');
      expect(msg).toBe(UserDomainCodes.NICKNAME_INVALID);
    }
  });

  it('CompletePrivacySetupSchema: nickname too short → domain code', () => {
    const result = CompletePrivacySetupSchema.safeParse({
      userId: 'test',
      nickname: 'ab',
      allowFindByName: true,
      allowFindByPhone: true,
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'nickname');
      expect(msg).toBe(UserDomainCodes.NICKNAME_INVALID);
    }
  });
});

describe('Schema domain codes — auth schemas', () => {
  it('RegisterUserSchema: empty first name → domain code', () => {
    const result = RegisterUserSchema.safeParse({
      firstName: '',
      lastName: 'Test',
      phoneNumber: '+79001234567',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
      consentGiven: true,
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'firstName');
      expect(msg).toBe(UserDomainCodes.FIRST_NAME_REQUIRED);
    }
  });

  it('RegisterUserSchema: empty last name → domain code', () => {
    const result = RegisterUserSchema.safeParse({
      firstName: 'Test',
      lastName: '',
      phoneNumber: '+79001234567',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
      consentGiven: true,
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'lastName');
      expect(msg).toBe(UserDomainCodes.LAST_NAME_REQUIRED);
    }
  });

  it('RegisterUserSchema: invalid phone → domain code', () => {
    const result = RegisterUserSchema.safeParse({
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: 'not-a-phone',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
      consentGiven: true,
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'phoneNumber');
      expect(msg).toBe(UserDomainCodes.PHONE_NUMBER_INVALID);
    }
  });

  it('RegisterUserSchema: short password → domain code', () => {
    const result = RegisterUserSchema.safeParse({
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: '+79001234567',
      password: 'short',
      confirmPassword: 'short',
      consentGiven: true,
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'password');
      expect(msg).toBe(UserDomainCodes.PASSWORD_TOO_SHORT);
    }
  });

  it('RegisterUserSchema: passwords mismatch → domain code', () => {
    const result = RegisterUserSchema.safeParse({
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: '+79001234567',
      password: 'securepassword123',
      confirmPassword: 'differentpassword',
      consentGiven: true,
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'confirmPassword');
      expect(msg).toBe(UserDomainCodes.PASSWORDS_MISMATCH);
    }
  });

  it('RegisterUserSchema: consent not given → domain code', () => {
    const result = RegisterUserSchema.safeParse({
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: '+79001234567',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
      consentGiven: false,
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'consentGiven');
      expect(msg).toBe(UserDomainCodes.CONSENT_REQUIRED);
    }
  });

  it('LoginUserSchema: invalid phone → domain code', () => {
    const result = LoginUserSchema.safeParse({
      phoneNumber: 'not-a-phone',
      password: 'somepassword',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'phoneNumber');
      expect(msg).toBe(UserDomainCodes.PHONE_NUMBER_INVALID);
    }
  });

  it('LoginUserSchema: empty password → domain code', () => {
    const result = LoginUserSchema.safeParse({
      phoneNumber: '+79001234567',
      password: '',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'password');
      expect(msg).toBe(UserDomainCodes.PASSWORD_REQUIRED);
    }
  });
});

describe('Schema domain codes — organization schema', () => {
  it('CreateOrganizationSchema: empty name → domain code', () => {
    const result = CreateOrganizationSchema.safeParse({
      name: '',
      description: 'Valid desc',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'name');
      expect(msg).toBe(OrganizationDomainCodes.ORGANIZATION_NAME_EMPTY);
    }
  });

  it('CreateOrganizationSchema: name too long → domain code', () => {
    const result = CreateOrganizationSchema.safeParse({
      name: 'x'.repeat(256),
      description: 'Valid desc',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'name');
      expect(msg).toBe(OrganizationDomainCodes.ORGANIZATION_NAME_TOO_LONG);
    }
  });

  it('CreateOrganizationSchema: empty description → domain code', () => {
    const result = CreateOrganizationSchema.safeParse({
      name: 'Valid Name',
      description: '',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'description');
      expect(msg).toBe(OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_EMPTY);
    }
  });

  it('CreateOrganizationSchema: description too long → domain code', () => {
    const result = CreateOrganizationSchema.safeParse({
      name: 'Valid Name',
      description: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'description');
      expect(msg).toBe(
        OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_TOO_LONG
      );
    }
  });
});

describe('Schema domain codes — board schema', () => {
  it('CreateBoardSchema: empty name → domain code', () => {
    const result = CreateBoardSchema.safeParse({
      name: '',
      organizationId: 'clxxxxxxxxxxxxxxxxxxxxxx',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'name');
      expect(msg).toBe(BoardDomainCodes.BOARD_NAME_EMPTY);
    }
  });

  it('CreateBoardSchema: name too long → domain code', () => {
    const result = CreateBoardSchema.safeParse({
      name: 'x'.repeat(256),
      organizationId: 'clxxxxxxxxxxxxxxxxxxxxxx',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const msg = getFieldError(result, 'name');
      expect(msg).toBe(BoardDomainCodes.BOARD_NAME_TOO_LONG);
    }
  });
});
