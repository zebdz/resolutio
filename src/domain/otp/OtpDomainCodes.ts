// OTP domain codes
// These should be translated at the presentation layer
export const OtpDomainCodes = {
  INVALID_CODE_FORMAT: 'domain.otp.invalidCodeFormat',
} as const;

export type OtpDomainCode =
  (typeof OtpDomainCodes)[keyof typeof OtpDomainCodes];
