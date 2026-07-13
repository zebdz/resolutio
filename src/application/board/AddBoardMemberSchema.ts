import { z } from 'zod';

export const AddBoardMemberSchema = z.object({
  boardId: z.string().min(1, 'Invalid board ID'),
  userId: z.string().min(1, 'Invalid user ID'),
});

export type AddBoardMemberInput = z.infer<typeof AddBoardMemberSchema>;
