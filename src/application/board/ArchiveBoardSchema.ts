import { z } from 'zod';

export const ArchiveBoardSchema = z.object({
  boardId: z.string().cuid('Invalid board ID'),
});

export type ArchiveBoardInput = z.infer<typeof ArchiveBoardSchema>;
