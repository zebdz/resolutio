import { z } from 'zod';
import { REJECTION_REASON_MAX_LENGTH } from '../../domain/organization/JoinParentRequest';

export const HandleJoinParentRequestSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  adminUserId: z.string().min(1, 'Admin user ID is required'),
  action: z.enum(['accept', 'reject']),
  rejectionReason: z.string().max(REJECTION_REASON_MAX_LENGTH).optional(),
});

export type HandleJoinParentRequestInput = z.infer<
  typeof HandleJoinParentRequestSchema
>;
