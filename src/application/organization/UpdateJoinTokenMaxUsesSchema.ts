import { z } from 'zod';

export const UpdateJoinTokenMaxUsesSchema = z.object({
  tokenId: z.string().min(1),
  maxUses: z.number().int().positive().nullable(),
});

export type UpdateJoinTokenMaxUsesInput = z.infer<
  typeof UpdateJoinTokenMaxUsesSchema
>;
