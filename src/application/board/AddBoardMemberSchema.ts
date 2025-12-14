import { z } from 'zod';

export const AddBoardMemberSchema = z.object({
  boardId: z.string().cuid('Invalid board ID'),
  userId: z.string().cuid('Invalid user ID'),
});

export type AddBoardMemberInput = z.infer<typeof AddBoardMemberSchema>;
