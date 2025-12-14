import { z } from 'zod';

export const GetOrganizationPendingRequestsSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
});

export type GetOrganizationPendingRequestsInput = z.infer<
  typeof GetOrganizationPendingRequestsSchema
>;
