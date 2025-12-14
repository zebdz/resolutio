// Domain-level error codes
// These represent validation errors at the entity level
export const DomainErrors = {
  // Organization validation
  ORGANIZATION_NAME_EMPTY: 'domain.errors.organizationNameEmpty',
  ORGANIZATION_NAME_TOO_LONG: 'domain.errors.organizationNameTooLong',
  ORGANIZATION_DESCRIPTION_EMPTY: 'domain.errors.organizationDescriptionEmpty',
  ORGANIZATION_DESCRIPTION_TOO_LONG:
    'domain.errors.organizationDescriptionTooLong',
  ORGANIZATION_ALREADY_ARCHIVED: 'domain.errors.organizationAlreadyArchived',

  // Board validation
  BOARD_NAME_EMPTY: 'domain.errors.boardNameEmpty',
  BOARD_NAME_TOO_LONG: 'domain.errors.boardNameTooLong',
  BOARD_ALREADY_ARCHIVED: 'domain.errors.boardAlreadyArchived',
} as const;

export type DomainError = (typeof DomainErrors)[keyof typeof DomainErrors];
