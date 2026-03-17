// Auth-related error codes
// These should be translated at the presentation layer
export const AuthErrors = {
  CONSENT_NOT_GIVEN: 'auth.register.errors.consentNotGiven',
  ACCOUNT_NOT_CONFIRMED: 'auth.errors.accountNotConfirmed',
  INVALID_CREDENTIALS: 'auth.errors.invalidCredentials',
  PHONE_EXISTS: 'auth.errors.phoneExists',
} as const;

export type AuthError = (typeof AuthErrors)[keyof typeof AuthErrors];
