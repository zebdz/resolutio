export const InvitationDomainCodes = {
  INVALID_DATA: 'domain.invitation.invalidData',
  NOT_PENDING: 'domain.invitation.notPending',
} as const;

export type InvitationDomainCode =
  (typeof InvitationDomainCodes)[keyof typeof InvitationDomainCodes];
