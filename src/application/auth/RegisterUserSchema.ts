import { z } from 'zod';
import { PHONE_NUMBER_REGEX } from '../../domain/user/PhoneNumber';
import {
  NAME_MAX_LENGTH,
  NAME_REGEX,
  PASSWORD_MIN_LENGTH,
  passwordMatchesPersonalInfo,
} from '../../domain/user/User';
import { UserDomainCodes } from '../../domain/user/UserDomainCodes';

export const RegisterUserSchema = z
  .object({
    firstName: z
      .string()
      .min(1, 'First name is required')
      .max(NAME_MAX_LENGTH, UserDomainCodes.FIRST_NAME_INVALID)
      .regex(NAME_REGEX, UserDomainCodes.FIRST_NAME_INVALID)
      .trim(),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .max(NAME_MAX_LENGTH, UserDomainCodes.LAST_NAME_INVALID)
      .regex(NAME_REGEX, UserDomainCodes.LAST_NAME_INVALID)
      .trim(),
    middleName: z
      .string()
      .max(NAME_MAX_LENGTH, UserDomainCodes.MIDDLE_NAME_INVALID)
      .regex(NAME_REGEX, UserDomainCodes.MIDDLE_NAME_INVALID)
      .trim()
      .optional()
      .or(z.literal('')),
    phoneNumber: z
      .string()
      .regex(PHONE_NUMBER_REGEX, 'Invalid phone number format'),
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
      ),
    confirmPassword: z.string(),
    language: z.enum(['en', 'ru']).optional().default('ru'),
    otpId: z.string().min(1, 'OTP verification is required'),
    consentGiven: z.literal(true, {
      message: 'Consent is required',
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
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
