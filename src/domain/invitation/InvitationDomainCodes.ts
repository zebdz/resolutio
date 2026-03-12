export const InvitationDomainCodes = {
  NOT_PENDING: 'domain.invitation.notPending',
} as const;

export type InvitationDomainCode =
  (typeof InvitationDomainCodes)[keyof typeof InvitationDomainCodes];
