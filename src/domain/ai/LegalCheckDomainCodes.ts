export const LegalCheckDomainCodes = {
  CHECKED_BY_REQUIRED: 'domain.legalCheck.checkedByRequired',
  INVALID_DATA: 'domain.legalCheck.invalidData',
  POLL_NOT_FOUND: 'domain.legalCheck.pollNotFound',
  ALREADY_IN_PROGRESS: 'domain.legalCheck.alreadyInProgress',
} as const;

export type LegalCheckDomainCode =
  (typeof LegalCheckDomainCodes)[keyof typeof LegalCheckDomainCodes];
