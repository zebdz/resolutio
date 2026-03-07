import { z } from 'zod';
import {
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
} from '../../domain/user/Nickname';

export const UpdateUserProfileSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  language: z.enum(['en', 'ru']).optional(),
  nickname: z
    .string()
    .min(NICKNAME_MIN_LENGTH)
    .max(NICKNAME_MAX_LENGTH)
    .optional(),
  allowFindByName: z.boolean().optional(),
  allowFindByPhone: z.boolean().optional(),
});

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;
