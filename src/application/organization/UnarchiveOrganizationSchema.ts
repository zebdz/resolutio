import { z } from 'zod';

export const UnarchiveOrganizationSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
});

export type UnarchiveOrganizationInput = z.infer<
  typeof UnarchiveOrganizationSchema
>;
