import { z } from 'zod';

export const CreateOrgMemberInviteSchema = z.object({
  organizationId: z.string().min(1),
  inviteeId: z.string().min(1),
});

export type CreateOrgMemberInviteInput = z.infer<
  typeof CreateOrgMemberInviteSchema
>;
