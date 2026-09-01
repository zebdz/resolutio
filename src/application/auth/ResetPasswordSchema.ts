import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '../../domain/user/User';
import { UserDomainCodes } from '../../domain/user/UserDomainCodes';

/**
 * Shape validation for the reset form. The personal-info check is deliberately
 * NOT here: it needs the resolved user, which only the use case has — and
 * running it before the code is verified would leak which accounts exist.
 */
export const resetPasswordSchema = z
  .object({
    identifier: z.string().min(1, UserDomainCodes.EMAIL_INVALID),
    code: z.string().length(6, UserDomainCodes.EMAIL_INVALID),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, UserDomainCodes.PASSWORD_TOO_SHORT),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: UserDomainCodes.PASSWORDS_MISMATCH,
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
