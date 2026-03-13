export const InvitationErrors = {
  NOT_FOUND: 'invitation.errors.notFound',
  NOT_PENDING: 'invitation.errors.notPending',
  ALREADY_INVITED: 'invitation.errors.alreadyInvited',
  INVITEE_ALREADY_ADMIN: 'invitation.errors.inviteeAlreadyAdmin',
  INVITEE_ALREADY_BOARD_MEMBER: 'invitation.errors.inviteeAlreadyBoardMember',
  INVITEE_ALREADY_MEMBER: 'invitation.errors.inviteeAlreadyMember',
  INVITEE_IN_HIERARCHY: 'invitation.errors.inviteeInHierarchy',
  NOT_INVITEE: 'invitation.errors.notInvitee',
  NOT_ADMIN: 'invitation.errors.notAdmin',
  ORG_NOT_FOUND: 'invitation.errors.orgNotFound',
  ORG_ARCHIVED: 'invitation.errors.orgArchived',
  BOARD_NOT_FOUND: 'invitation.errors.boardNotFound',
  BOARD_ARCHIVED: 'invitation.errors.boardArchived',
  USER_NOT_FOUND: 'invitation.errors.userNotFound',
  INVITEE_HAS_PENDING_REQUEST: 'invitation.errors.inviteeHasPendingRequest',
} as const;

export type InvitationError =
  (typeof InvitationErrors)[keyof typeof InvitationErrors];
