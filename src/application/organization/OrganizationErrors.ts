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
  PENDING_INVITE: 'organization.errors.pendingInvite',
  REJECTED_REQUEST: 'organization.errors.rejectedRequest',
  HIERARCHY_CONFLICT: 'organization.errors.hierarchyConflict',
  PENDING_HIERARCHY_REQUEST: 'organization.errors.pendingHierarchyRequest',

  // Create
  PARENT_NOT_FOUND: 'organization.errors.parentNotFound',
  PARENT_ARCHIVED: 'organization.errors.parentArchived',

  // Admin/Authorization
  NOT_ADMIN: 'organization.errors.notAdmin',
  INVALID_STATUS: 'organization.errors.invalidStatus',
  REQUEST_NOT_FOUND: 'organization.errors.requestNotFound',
  NOT_PENDING: 'organization.errors.notPending',

  // Join Parent Request
  CANNOT_JOIN_OWN_DESCENDANT: 'organization.errors.cannotJoinOwnDescendant',
  PENDING_PARENT_REQUEST: 'organization.errors.pendingParentRequest',
  PARENT_REQUEST_NOT_FOUND: 'organization.errors.parentRequestNotFound',
  PARENT_REQUEST_NOT_PENDING: 'organization.errors.parentRequestNotPending',
  SAME_ORGANIZATION: 'organization.errors.sameOrganization',
  CHILD_ORG_NOT_FOUND: 'organization.errors.childOrgNotFound',
  CHILD_ORG_ARCHIVED: 'organization.errors.childOrgArchived',
  REJECTION_REASON_REQUIRED: 'organization.errors.rejectionReasonRequired',

  // Admin management
  LAST_ADMIN: 'organization.errors.lastAdmin',
  ALREADY_ADMIN: 'organization.errors.alreadyAdmin',
  NOT_ORG_ADMIN: 'organization.errors.notOrgAdmin',
  CANNOT_REMOVE_SELF: 'organization.errors.cannotRemoveSelf',
  USER_NOT_FOUND: 'organization.errors.userNotFound',
} as const;

export type OrganizationError =
  (typeof OrganizationErrors)[keyof typeof OrganizationErrors];
