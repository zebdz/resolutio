import { z } from 'zod';
import {
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
} from '../../domain/user/Nickname';
import { UserDomainCodes } from '../../domain/user/UserDomainCodes';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

export const completePrivacySetupSchema = (
  profanityChecker: ProfanityChecker
) =>
  z.object({
    userId: z.string().min(1),
    nickname: z
      .string()
      .min(NICKNAME_MIN_LENGTH, UserDomainCodes.NICKNAME_INVALID)
      .max(NICKNAME_MAX_LENGTH, UserDomainCodes.NICKNAME_INVALID)
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      })
      .optional(),
    allowFindByName: z.boolean(),
    allowFindByPhone: z.boolean(),
  });

// Keep backward-compatible constant with a no-op profanity checker for tests
export const CompletePrivacySetupSchema = completePrivacySetupSchema({
  containsProfanity: () => false,
});

export type CompletePrivacySetupInput = z.infer<
  typeof CompletePrivacySetupSchema
>;
