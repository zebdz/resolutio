import { z } from 'zod';

export const UnarchiveOrganizationSchema = z.object({
  organizationId: z.string().min(1, 'Invalid organization ID'),
});

export type UnarchiveOrganizationInput = z.infer<
  typeof UnarchiveOrganizationSchema
>;
