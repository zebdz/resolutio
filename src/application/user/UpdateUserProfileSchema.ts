import { z } from 'zod';
import {
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
} from '../../domain/user/Nickname';
import { UserDomainCodes } from '../../domain/user/UserDomainCodes';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

export const updateUserProfileSchema = (profanityChecker: ProfanityChecker) =>
  z.object({
    userId: z.string().min(1, 'User ID is required'),
    language: z.enum(['en', 'ru']).optional(),
    nickname: z
      .string()
      .min(NICKNAME_MIN_LENGTH, UserDomainCodes.NICKNAME_INVALID)
      .max(NICKNAME_MAX_LENGTH, UserDomainCodes.NICKNAME_INVALID)
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      })
      .optional(),
    allowFindByName: z.boolean().optional(),
    allowFindByPhone: z.boolean().optional(),
  });

// Keep backward-compatible constant with a no-op profanity checker for tests
export const UpdateUserProfileSchema = updateUserProfileSchema({
  containsProfanity: () => false,
});

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;
