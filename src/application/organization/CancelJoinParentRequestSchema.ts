import { z } from 'zod';

export const CancelJoinParentRequestSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  adminUserId: z.string().min(1, 'Admin user ID is required'),
});

export type CancelJoinParentRequestInput = z.infer<
  typeof CancelJoinParentRequestSchema
>;
