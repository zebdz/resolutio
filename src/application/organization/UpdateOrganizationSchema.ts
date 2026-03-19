import { z } from 'zod';
import {
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_DESCRIPTION_MAX_LENGTH,
} from '../../domain/organization/Organization';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

export const updateOrganizationSchema = (profanityChecker: ProfanityChecker) =>
  z.object({
    organizationId: z.string().min(1),
    name: z
      .string()
      .min(1, OrganizationDomainCodes.ORGANIZATION_NAME_EMPTY)
      .max(
        ORGANIZATION_NAME_MAX_LENGTH,
        OrganizationDomainCodes.ORGANIZATION_NAME_TOO_LONG
      )
      .trim()
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      }),
    description: z
      .string()
      .min(1, OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_EMPTY)
      .max(
        ORGANIZATION_DESCRIPTION_MAX_LENGTH,
        OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_TOO_LONG
      )
      .trim()
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      }),
    allowMultiTreeMembership: z.boolean().optional(),
  });
