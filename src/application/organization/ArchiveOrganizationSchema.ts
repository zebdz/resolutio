import { z } from 'zod';

export const ArchiveOrganizationSchema = z.object({
  organizationId: z.string().min(1, 'Invalid organization ID'),
});

export type ArchiveOrganizationInput = z.infer<
  typeof ArchiveOrganizationSchema
>;
