import { z } from 'zod';

export const HandleJoinParentRequestSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  adminUserId: z.string().min(1, 'Admin user ID is required'),
  action: z.enum(['accept', 'reject']),
  rejectionReason: z.string().max(2000).optional(),
});

export type HandleJoinParentRequestInput = z.infer<
  typeof HandleJoinParentRequestSchema
>;
