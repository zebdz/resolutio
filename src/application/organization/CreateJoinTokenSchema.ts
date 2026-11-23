/** Join-link request validation retains the domain usage-limit unit after parsing. */
import { z } from 'zod';
import { JoinTokenMaxUses } from '../../domain/organization/JoinTokenValues';
import { JOIN_TOKEN_DESCRIPTION_MAX_LENGTH } from '../../domain/organization/JoinToken';
import { JoinTokenDomainCodes } from '../../domain/organization/JoinTokenDomainCodes';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

export const createJoinTokenSchema = (profanityChecker: ProfanityChecker) =>
  z.object({
    organizationId: z.string().min(1),
    description: z
      .string()
      .min(1, JoinTokenDomainCodes.DESCRIPTION_EMPTY)
      .max(
        JOIN_TOKEN_DESCRIPTION_MAX_LENGTH,
        JoinTokenDomainCodes.DESCRIPTION_TOO_LONG
      )
      .trim()
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      }),
    maxUses: JoinTokenMaxUses.nullable().optional(),
  });

export type CreateJoinTokenInput = z.input<
  ReturnType<typeof createJoinTokenSchema>
>;
