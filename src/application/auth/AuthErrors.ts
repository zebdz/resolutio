// Auth-related error codes
// These should be translated at the presentation layer
export const AuthErrors = {
  CONSENT_NOT_GIVEN: 'auth.register.errors.consentNotGiven',
} as const;

export type AuthError = (typeof AuthErrors)[keyof typeof AuthErrors];
