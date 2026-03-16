export const JoinTokenDomainCodes = {
  DESCRIPTION_EMPTY: 'domain.joinToken.descriptionEmpty',
  DESCRIPTION_TOO_LONG: 'domain.joinToken.descriptionTooLong',
  MAX_USES_INVALID: 'domain.joinToken.maxUsesInvalid',
  ALREADY_EXPIRED: 'domain.joinToken.alreadyExpired',
  NOT_EXPIRED: 'domain.joinToken.notExpired',
  TOKEN_EXHAUSTED: 'domain.joinToken.tokenExhausted',
} as const;

export type JoinTokenDomainCode =
  (typeof JoinTokenDomainCodes)[keyof typeof JoinTokenDomainCodes];
