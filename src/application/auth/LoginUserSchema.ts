import { z } from 'zod';
import { PHONE_NUMBER_REGEX } from '../../domain/user/PhoneNumber';
import { UserDomainCodes } from '../../domain/user/UserDomainCodes';

export const LoginUserSchema = z.object({
  phoneNumber: z
    .string()
    .regex(PHONE_NUMBER_REGEX, UserDomainCodes.PHONE_NUMBER_INVALID),
  password: z.string().min(1, UserDomainCodes.PASSWORD_REQUIRED),
});

export type LoginUserInput = z.infer<typeof LoginUserSchema>;
