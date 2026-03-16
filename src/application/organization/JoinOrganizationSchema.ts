import { z } from 'zod';

export const JoinOrganizationSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  joinTokenId: z.string().optional(),
});

export type JoinOrganizationInput = z.infer<typeof JoinOrganizationSchema>;
