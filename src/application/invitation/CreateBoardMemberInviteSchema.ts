import { z } from 'zod';

export const CreateBoardMemberInviteSchema = z.object({
  boardId: z.string().min(1),
  inviteeId: z.string().min(1),
});

export type CreateBoardMemberInviteInput = z.infer<
  typeof CreateBoardMemberInviteSchema
>;
