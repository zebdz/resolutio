import { z } from 'zod';

export const RequestJoinParentSchema = z.object({
  childOrgId: z.string().min(1, 'Child organization ID is required'),
  parentOrgId: z.string().min(1, 'Parent organization ID is required'),
  adminUserId: z.string().min(1, 'Admin user ID is required'),
  message: z.string().min(1, 'Message is required').max(2000),
});

export type RequestJoinParentInput = z.infer<typeof RequestJoinParentSchema>;
