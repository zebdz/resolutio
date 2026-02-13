export const JoinParentRequestDomainCodes = {
  MESSAGE_EMPTY: 'domain.joinParentRequest.messageEmpty',
  MESSAGE_TOO_LONG: 'domain.joinParentRequest.messageTooLong',
  NOT_PENDING: 'domain.joinParentRequest.notPending',
  REJECTION_REASON_REQUIRED: 'domain.joinParentRequest.rejectionReasonRequired',
} as const;

export type JoinParentRequestDomainCode =
  (typeof JoinParentRequestDomainCodes)[keyof typeof JoinParentRequestDomainCodes];
