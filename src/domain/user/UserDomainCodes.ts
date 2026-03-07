// Domain-level codes for User entity
export const UserDomainCodes = {
  USER_NOT_FOUND: 'domain.user.userNotFound',
  NICKNAME_TAKEN: 'domain.user.nicknameTaken',
  NICKNAME_INVALID: 'domain.user.nicknameInvalid',
  PRIVACY_SETUP_REQUIRED: 'domain.user.privacySetupRequired',
  FIRST_NAME_INVALID: 'domain.user.firstNameInvalid',
  LAST_NAME_INVALID: 'domain.user.lastNameInvalid',
  MIDDLE_NAME_INVALID: 'domain.user.middleNameInvalid',
  PASSWORD_MATCHES_PERSONAL_INFO: 'domain.user.passwordMatchesPersonalInfo',
} as const;

export type UserDomainCode =
  (typeof UserDomainCodes)[keyof typeof UserDomainCodes];
