// OTP-related error codes
// These should be translated at the presentation layer
export const OtpErrors = {
  EXPIRED: 'otp.errors.expired',
  INVALID: 'otp.errors.invalid',
  MAX_ATTEMPTS: 'otp.errors.maxAttempts',
  THROTTLED: 'otp.errors.throttled',
  ALREADY_VERIFIED: 'otp.errors.alreadyVerified',
  NOT_FOUND: 'otp.errors.notFound',
  SEND_FAILED: 'otp.errors.sendFailed',
  CAPTCHA_FAILED: 'otp.errors.captchaFailed',
  NOT_VERIFIED: 'otp.errors.notVerified',
  PHONE_MISMATCH: 'otp.errors.phoneMismatch',
} as const;

export type OtpError = (typeof OtpErrors)[keyof typeof OtpErrors];
