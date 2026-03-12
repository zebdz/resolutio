import { z } from 'zod';

export const CreateAdminInviteSchema = z.object({
  organizationId: z.string().min(1),
  inviteeId: z.string().min(1),
});

export type CreateAdminInviteInput = z.infer<typeof CreateAdminInviteSchema>;
