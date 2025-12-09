import { z } from 'zod';

export const UpdateUserProfileSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  language: z.enum(['en', 'ru']).optional(),
});

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;
