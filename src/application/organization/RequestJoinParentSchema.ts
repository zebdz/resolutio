import { z } from 'zod';
import { JOIN_PARENT_REQUEST_MESSAGE_MAX_LENGTH } from '../../domain/organization/JoinParentRequest';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

export const createRequestJoinParentSchema = (
  profanityChecker: ProfanityChecker
) =>
  z.object({
    childOrgId: z.string().min(1, 'Child organization ID is required'),
    parentOrgId: z.string().min(1, 'Parent organization ID is required'),
    adminUserId: z.string().min(1, 'Admin user ID is required'),
    message: z
      .string()
      .min(1, 'Message is required')
      .max(JOIN_PARENT_REQUEST_MESSAGE_MAX_LENGTH)
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      }),
  });

export type RequestJoinParentInput = z.input<
  ReturnType<typeof createRequestJoinParentSchema>
>;
