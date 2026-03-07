import { z } from 'zod';
import {
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
} from '../../domain/user/Nickname';

export const CompletePrivacySetupSchema = z.object({
  userId: z.string().min(1),
  nickname: z
    .string()
    .min(NICKNAME_MIN_LENGTH)
    .max(NICKNAME_MAX_LENGTH)
    .optional(),
  allowFindByName: z.boolean(),
  allowFindByPhone: z.boolean(),
});

export type CompletePrivacySetupInput = z.infer<
  typeof CompletePrivacySetupSchema
>;
