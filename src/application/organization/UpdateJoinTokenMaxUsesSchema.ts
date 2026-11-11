/** Decodes a requested usage limit; null explicitly means unlimited usage. */
import { z } from 'zod';
import { JoinTokenMaxUses } from '../../domain/organization/JoinTokenValues';

export const UpdateJoinTokenMaxUsesSchema = z.object({
  tokenId: z.string().min(1),
  maxUses: JoinTokenMaxUses.nullable(),
});

export type UpdateJoinTokenMaxUsesInput = z.input<
  typeof UpdateJoinTokenMaxUsesSchema
>;
