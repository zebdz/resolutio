import { z } from 'zod';
import { REJECTION_REASON_MAX_LENGTH } from '../../domain/organization/JoinParentRequest';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

export const createHandleJoinRequestSchema = (
  profanityChecker: ProfanityChecker
) =>
  z.object({
    organizationId: z.string().min(1, 'Organization ID is required'),
    requesterId: z.string().min(1, 'Requester ID is required'),
    adminId: z.string().min(1, 'Admin ID is required'),
    action: z.enum(['accept', 'reject']),
    rejectionReason: z
      .string()
      .max(REJECTION_REASON_MAX_LENGTH)
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      })
      .optional(),
    silent: z.boolean().optional(),
  });

export type HandleJoinRequestInput = z.input<
  ReturnType<typeof createHandleJoinRequestSchema>
>;
