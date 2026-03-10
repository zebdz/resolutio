// Domain-level codes for User entity
export const UserDomainCodes = {
  USER_NOT_FOUND: 'domain.user.userNotFound',
  NICKNAME_TAKEN: 'domain.user.nicknameTaken',
  NICKNAME_INVALID: 'domain.user.nicknameInvalid',
  PRIVACY_SETUP_REQUIRED: 'domain.user.privacySetupRequired',
  FIRST_NAME_REQUIRED: 'domain.user.firstNameRequired',
  FIRST_NAME_INVALID: 'domain.user.firstNameInvalid',
  LAST_NAME_REQUIRED: 'domain.user.lastNameRequired',
  LAST_NAME_INVALID: 'domain.user.lastNameInvalid',
  MIDDLE_NAME_INVALID: 'domain.user.middleNameInvalid',
  PHONE_NUMBER_INVALID: 'domain.user.phoneNumberInvalid',
  PASSWORD_REQUIRED: 'domain.user.passwordRequired',
  PASSWORD_TOO_SHORT: 'domain.user.passwordTooShort',
  CONSENT_REQUIRED: 'domain.user.consentRequired',
  PASSWORDS_MISMATCH: 'domain.user.passwordsMismatch',
  PASSWORD_MATCHES_PERSONAL_INFO: 'domain.user.passwordMatchesPersonalInfo',
} as const;

export type UserDomainCode =
  (typeof UserDomainCodes)[keyof typeof UserDomainCodes];
