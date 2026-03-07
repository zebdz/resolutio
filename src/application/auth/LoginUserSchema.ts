import { z } from 'zod';
import { PHONE_NUMBER_REGEX } from '../../domain/user/PhoneNumber';

export const LoginUserSchema = z.object({
  phoneNumber: z
    .string()
    .regex(PHONE_NUMBER_REGEX, 'Invalid phone number format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginUserInput = z.infer<typeof LoginUserSchema>;
