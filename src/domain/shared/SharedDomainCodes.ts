export const SharedDomainCodes = {
  INVALID_ATTACHMENT_METADATA: 'domain.shared.invalidAttachmentMetadata',
  CONTAINS_PROFANITY: 'domain.shared.containsProfanity',
  CONTAINS_PROFANITY_WITH_WORDS: 'domain.shared.containsProfanityWithWords',
} as const;

export type SharedDomainCode =
  (typeof SharedDomainCodes)[keyof typeof SharedDomainCodes];
