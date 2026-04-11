export const LegalCheckDomainCodes = {
  POLL_NOT_FOUND: 'domain.legalCheck.pollNotFound',
  ALREADY_IN_PROGRESS: 'domain.legalCheck.alreadyInProgress',
} as const;

export type LegalCheckDomainCode =
  (typeof LegalCheckDomainCodes)[keyof typeof LegalCheckDomainCodes];
