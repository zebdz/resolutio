import { z } from 'zod';
import {
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
} from '../../domain/user/Nickname';
import { UserDomainCodes } from '../../domain/user/UserDomainCodes';

export const UpdateUserProfileSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  language: z.enum(['en', 'ru']).optional(),
  nickname: z
    .string()
    .min(NICKNAME_MIN_LENGTH, UserDomainCodes.NICKNAME_INVALID)
    .max(NICKNAME_MAX_LENGTH, UserDomainCodes.NICKNAME_INVALID)
    .optional(),
  allowFindByName: z.boolean().optional(),
  allowFindByPhone: z.boolean().optional(),
});

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;
