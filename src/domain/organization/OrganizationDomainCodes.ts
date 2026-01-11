// Domain-level codes
// These represent validation errors at the entity level
export const OrganizationDomainCodes = {
  // Organization validation
  ORGANIZATION_NAME_EMPTY: 'domain.organization.organizationNameEmpty',
  ORGANIZATION_NAME_TOO_LONG: 'domain.organization.organizationNameTooLong',
  ORGANIZATION_DESCRIPTION_EMPTY:
    'domain.organization.organizationDescriptionEmpty',
  ORGANIZATION_DESCRIPTION_TOO_LONG:
    'domain.organization.organizationDescriptionTooLong',
  ORGANIZATION_ALREADY_ARCHIVED:
    'domain.organization.organizationAlreadyArchived',
} as const;

export type OrganizationDomainCode =
  (typeof OrganizationDomainCodes)[keyof typeof OrganizationDomainCodes];
