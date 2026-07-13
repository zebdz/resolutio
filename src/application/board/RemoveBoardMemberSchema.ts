import { z } from 'zod';

export const RemoveBoardMemberSchema = z.object({
  boardId: z.string().min(1, 'Invalid board ID'),
  userId: z.string().min(1, 'Invalid user ID'),
  reason: z.string().optional(),
});

export type RemoveBoardMemberInput = z.infer<typeof RemoveBoardMemberSchema>;
