import { z } from 'zod';
import {
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_DESCRIPTION_MAX_LENGTH,
} from '../../domain/organization/Organization';

export const CreateOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(
      ORGANIZATION_NAME_MAX_LENGTH,
      `Organization name cannot exceed ${ORGANIZATION_NAME_MAX_LENGTH} characters`
    )
    .trim(),
  description: z
    .string()
    .min(1, 'Organization description is required')
    .max(
      ORGANIZATION_DESCRIPTION_MAX_LENGTH,
      `Organization description cannot exceed ${ORGANIZATION_DESCRIPTION_MAX_LENGTH} characters`
    )
    .trim(),
  parentId: z.string().optional().nullable(),
  autoJoin: z.boolean().optional().default(true),
});

// Use z.input so autoJoin remains optional for callers (use case ignores it)
export type CreateOrganizationInput = z.input<typeof CreateOrganizationSchema>;
