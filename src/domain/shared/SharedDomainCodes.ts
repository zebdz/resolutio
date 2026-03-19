export const SharedDomainCodes = {
  CONTAINS_PROFANITY: 'domain.shared.containsProfanity',
} as const;

export type SharedDomainCode =
  (typeof SharedDomainCodes)[keyof typeof SharedDomainCodes];
