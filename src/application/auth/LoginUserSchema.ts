import { z } from 'zod';

export const LoginUserSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginUserInput = z.infer<typeof LoginUserSchema>;
