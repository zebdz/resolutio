import { z } from 'zod';
import {
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_DESCRIPTION_MAX_LENGTH,
} from '../../domain/organization/Organization';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export const CreateOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, OrganizationDomainCodes.ORGANIZATION_NAME_EMPTY)
    .max(
      ORGANIZATION_NAME_MAX_LENGTH,
      OrganizationDomainCodes.ORGANIZATION_NAME_TOO_LONG
    )
    .trim(),
  description: z
    .string()
    .min(1, OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_EMPTY)
    .max(
      ORGANIZATION_DESCRIPTION_MAX_LENGTH,
      OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_TOO_LONG
    )
    .trim(),
  parentId: z.string().optional().nullable(),
  autoJoin: z.boolean().optional().default(true),
  allowMultiTreeMembership: z.boolean().optional().default(false),
});

// Use z.input so autoJoin remains optional for callers (use case ignores it)
export type CreateOrganizationInput = z.input<typeof CreateOrganizationSchema>;
