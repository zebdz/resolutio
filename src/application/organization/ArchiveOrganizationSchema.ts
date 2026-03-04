import { z } from 'zod';

export const ArchiveOrganizationSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
});

export type ArchiveOrganizationInput = z.infer<
  typeof ArchiveOrganizationSchema
>;
