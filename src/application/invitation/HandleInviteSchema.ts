import { z } from 'zod';

export const HandleInviteSchema = z.object({
  invitationId: z.string().min(1),
  action: z.enum(['accept', 'decline']),
});

export type HandleInviteInput = z.infer<typeof HandleInviteSchema>;
