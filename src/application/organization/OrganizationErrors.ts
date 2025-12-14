// Organization-related error codes
// These should be translated at the presentation layer
export const OrganizationErrors = {
  // General
  NOT_FOUND: 'organization.errors.notFound',
  ARCHIVED: 'organization.errors.archived',
  NAME_EXISTS: 'organization.errors.nameExists',

  // Join/Membership
  ALREADY_MEMBER: 'organization.errors.alreadyMember',
  PENDING_REQUEST: 'organization.errors.pendingRequest',
  REJECTED_REQUEST: 'organization.errors.rejectedRequest',
  HIERARCHY_CONFLICT: 'organization.errors.hierarchyConflict',

  // Create
  PARENT_NOT_FOUND: 'organization.errors.parentNotFound',
  PARENT_ARCHIVED: 'organization.errors.parentArchived',

  // Admin/Authorization
  NOT_ADMIN: 'organization.errors.notAdmin',
  INVALID_STATUS: 'organization.errors.invalidStatus',
  REQUEST_NOT_FOUND: 'organization.errors.requestNotFound',
  NOT_PENDING: 'organization.errors.notPending',
} as const;

export type OrganizationError =
  (typeof OrganizationErrors)[keyof typeof OrganizationErrors];
