import { z } from 'zod';

export const CreateOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(255, 'Organization name cannot exceed 255 characters')
    .trim(),
  description: z
    .string()
    .min(1, 'Organization description is required')
    .max(2000, 'Organization description cannot exceed 2000 characters')
    .trim(),
  parentId: z.string().optional().nullable(),
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
