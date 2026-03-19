import { z } from 'zod';
import { PHONE_NUMBER_REGEX } from '../../domain/user/PhoneNumber';
import {
  NAME_MAX_LENGTH,
  NAME_REGEX,
  PASSWORD_MIN_LENGTH,
  passwordMatchesPersonalInfo,
} from '../../domain/user/User';
import { UserDomainCodes } from '../../domain/user/UserDomainCodes';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

export const registerUserSchema = (profanityChecker: ProfanityChecker) =>
  z
    .object({
      firstName: z
        .string()
        .min(1, UserDomainCodes.FIRST_NAME_REQUIRED)
        .max(NAME_MAX_LENGTH, UserDomainCodes.FIRST_NAME_INVALID)
        .regex(NAME_REGEX, UserDomainCodes.FIRST_NAME_INVALID)
        .trim()
        .refine((val) => !profanityChecker.containsProfanity(val), {
          message: SharedDomainCodes.CONTAINS_PROFANITY,
        }),
      lastName: z
        .string()
        .min(1, UserDomainCodes.LAST_NAME_REQUIRED)
        .max(NAME_MAX_LENGTH, UserDomainCodes.LAST_NAME_INVALID)
        .regex(NAME_REGEX, UserDomainCodes.LAST_NAME_INVALID)
        .trim()
        .refine((val) => !profanityChecker.containsProfanity(val), {
          message: SharedDomainCodes.CONTAINS_PROFANITY,
        }),
      middleName: z
        .string()
        .max(NAME_MAX_LENGTH, UserDomainCodes.MIDDLE_NAME_INVALID)
        .regex(NAME_REGEX, UserDomainCodes.MIDDLE_NAME_INVALID)
        .trim()
        .refine((val) => !profanityChecker.containsProfanity(val), {
          message: SharedDomainCodes.CONTAINS_PROFANITY,
        })
        .optional()
        .or(z.literal('')),
      phoneNumber: z
        .string()
        .regex(PHONE_NUMBER_REGEX, UserDomainCodes.PHONE_NUMBER_INVALID),
      password: z
        .string()
        .min(PASSWORD_MIN_LENGTH, UserDomainCodes.PASSWORD_TOO_SHORT),
      confirmPassword: z.string(),
      language: z.enum(['en', 'ru']).optional().default('ru'),
      consentGiven: z.literal(true, {
        message: UserDomainCodes.CONSENT_REQUIRED,
      }),
    })
    .refine(
      (data) =>
        !passwordMatchesPersonalInfo(data.password, {
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName || undefined,
          phoneNumber: data.phoneNumber,
        }),
      {
        message: UserDomainCodes.PASSWORD_MATCHES_PERSONAL_INFO,
        path: ['password'],
      }
    )
    .refine((data) => data.password === data.confirmPassword, {
      message: UserDomainCodes.PASSWORDS_MISMATCH,
      path: ['confirmPassword'],
    });

// Keep backward-compatible constant with a no-op profanity checker for tests
export const RegisterUserSchema = registerUserSchema({
  containsProfanity: () => false,
});

export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
