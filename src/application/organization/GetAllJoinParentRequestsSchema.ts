import { z } from 'zod';

export const GetAllJoinParentRequestsSchema = z.object({
  organizationId: z.string().min(1),
  adminUserId: z.string().min(1),
});

export type GetAllJoinParentRequestsInput = z.infer<
  typeof GetAllJoinParentRequestsSchema
>;
