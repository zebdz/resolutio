export const AIErrors = {
  NOT_ADMIN: 'legalCheck.errors.notAdmin',
  POLL_NOT_FOUND: 'legalCheck.errors.pollNotFound',
  POLL_NOT_IN_ORG: 'legalCheck.errors.pollNotInOrg',
  POLL_NOT_READY: 'legalCheck.errors.pollNotReady',
  ORG_TOO_SMALL: 'legalCheck.errors.orgTooSmall',
  RATE_LIMIT_EXCEEDED: 'legalCheck.errors.rateLimitExceeded',
  TOKEN_CAP_EXCEEDED: 'legalCheck.errors.tokenCapExceeded',
  PROVIDER_ERROR: 'legalCheck.errors.providerError',
  INVALID_MODEL: 'legalCheck.errors.invalidModel',
} as const;

export type AIError = (typeof AIErrors)[keyof typeof AIErrors];
