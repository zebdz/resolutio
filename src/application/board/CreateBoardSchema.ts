import { z } from 'zod';

export const CreateBoardSchema = z.object({
  name: z
    .string()
    .min(1, 'Board name is required')
    .max(255, 'Board name must be less than 255 characters'),
  organizationId: z.string().cuid('Invalid organization ID'),
});

export type CreateBoardInput = z.infer<typeof CreateBoardSchema>;
