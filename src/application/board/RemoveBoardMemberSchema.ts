import { z } from 'zod';

export const RemoveBoardMemberSchema = z.object({
  boardId: z.string().cuid('Invalid board ID'),
  userId: z.string().cuid('Invalid user ID'),
  reason: z.string().optional(),
});

export type RemoveBoardMemberInput = z.infer<typeof RemoveBoardMemberSchema>;
