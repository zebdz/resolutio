import { z } from 'zod';
import { REJECTION_REASON_MAX_LENGTH } from '../../domain/organization/JoinParentRequest';

export const HandleJoinRequestSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  requesterId: z.string().min(1, 'Requester ID is required'),
  adminId: z.string().min(1, 'Admin ID is required'),
  action: z.enum(['accept', 'reject']),
  rejectionReason: z.string().max(REJECTION_REASON_MAX_LENGTH).optional(),
  silent: z.boolean().optional(),
});

export type HandleJoinRequestInput = z.infer<typeof HandleJoinRequestSchema>;
