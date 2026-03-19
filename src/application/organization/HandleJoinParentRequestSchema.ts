import { z } from 'zod';
import { REJECTION_REASON_MAX_LENGTH } from '../../domain/organization/JoinParentRequest';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

export const createHandleJoinParentRequestSchema = (
  profanityChecker: ProfanityChecker
) =>
  z.object({
    requestId: z.string().min(1, 'Request ID is required'),
    adminUserId: z.string().min(1, 'Admin user ID is required'),
    action: z.enum(['accept', 'reject']),
    rejectionReason: z
      .string()
      .max(REJECTION_REASON_MAX_LENGTH)
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      })
      .optional(),
  });

export type HandleJoinParentRequestInput = z.input<
  ReturnType<typeof createHandleJoinParentRequestSchema>
>;
