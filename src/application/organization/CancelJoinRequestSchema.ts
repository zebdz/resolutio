import { z } from 'zod';

export const CancelJoinRequestSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});

export type CancelJoinRequestInput = z.infer<typeof CancelJoinRequestSchema>;
