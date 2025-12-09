import { z } from 'zod';

export const RegisterUserSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').trim(),
    lastName: z.string().min(1, 'Last name is required').trim(),
    middleName: z.string().trim().optional(),
    phoneNumber: z
      .string()
      .regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
