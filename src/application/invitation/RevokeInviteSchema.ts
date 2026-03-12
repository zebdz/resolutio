import { z } from 'zod';

export const RevokeInviteSchema = z.object({
  invitationId: z.string().min(1),
});

export type RevokeInviteInput = z.infer<typeof RevokeInviteSchema>;
