import { z } from 'zod';

export const ArchiveBoardSchema = z.object({
  boardId: z.string().min(1, 'Invalid board ID'),
});

export type ArchiveBoardInput = z.infer<typeof ArchiveBoardSchema>;
