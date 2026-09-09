/**
 * Which controls of a code-entry form (the confirm-phone page, the email
 * confirmation on the account page) are usable, derived from state the server
 * reported plus what the user has done since. Pure, so the rules that once
 * left both buttons dead can be tested without rendering.
 */
export type RequestCodeLabel = 'sendCode' | 'resend' | 'resendIn';

export interface OtpControlsInput {
  // The server knows of a code that was sent and can still be entered.
  hasPendingCode: boolean;
  otpCodeLength: number;
  // A server action is in flight.
  isPending: boolean;
  // Seconds until the throttle allows another code.
  resendCountdown: number;
  captchaRequired: boolean;
  hasCaptchaToken: boolean;
}

export interface OtpControls {
  canVerify: boolean;
  canRequestCode: boolean;
  requestLabel: RequestCodeLabel;
}

export const OTP_CODE_LENGTH = 6;

export function deriveOtpControls(input: OtpControlsInput): OtpControls {
  const canVerify =
    input.hasPendingCode &&
    input.otpCodeLength >= OTP_CODE_LENGTH &&
    !input.isPending;

  const canRequestCode =
    !input.isPending &&
    input.resendCountdown <= 0 &&
    (!input.captchaRequired || input.hasCaptchaToken);

  let requestLabel: RequestCodeLabel = 'sendCode';

  if (input.resendCountdown > 0) {
    requestLabel = 'resendIn';
  } else if (input.hasPendingCode) {
    requestLabel = 'resend';
  }

  return { canVerify, canRequestCode, requestLabel };
}
