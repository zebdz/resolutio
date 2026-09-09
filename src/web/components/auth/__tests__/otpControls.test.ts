import { describe, it, expect } from 'vitest';
import { deriveOtpControls } from '../otpControls';

// The page used to have both buttons dead after a failed mount-time request:
// no code to verify, and a resend gated on a token the form had just wiped.
const base = {
  hasPendingCode: true,
  otpCodeLength: 6,
  isPending: false,
  resendCountdown: 0,
  captchaRequired: true,
  hasCaptchaToken: true,
};

describe('deriveOtpControls', () => {
  it('keeps verify disabled until a code is pending, even with six digits typed', () => {
    const controls = deriveOtpControls({
      ...base,
      hasPendingCode: false,
    });

    expect(controls.canVerify).toBe(false);
  });

  it('enables verify once a code is pending and six digits are typed', () => {
    expect(deriveOtpControls(base).canVerify).toBe(true);
  });

  it('keeps verify disabled with fewer than six digits', () => {
    const controls = deriveOtpControls({ ...base, otpCodeLength: 5 });

    expect(controls.canVerify).toBe(false);
  });

  it('offers to send a code when none is pending', () => {
    const controls = deriveOtpControls({
      ...base,
      hasPendingCode: false,
    });

    expect(controls.requestLabel).toBe('sendCode');
    expect(controls.canRequestCode).toBe(true);
  });

  it('offers to resend when a code is pending', () => {
    expect(deriveOtpControls(base).requestLabel).toBe('resend');
  });

  it('shows the countdown and blocks requests while the throttle runs', () => {
    const controls = deriveOtpControls({
      ...base,
      resendCountdown: 30,
    });

    expect(controls.requestLabel).toBe('resendIn');
    expect(controls.canRequestCode).toBe(false);
  });

  it('blocks requests until the captcha is solved when one is required', () => {
    const unsolved = deriveOtpControls({
      ...base,
      hasCaptchaToken: false,
    });
    const solved = deriveOtpControls({
      ...base,
      hasCaptchaToken: true,
    });

    expect(unsolved.canRequestCode).toBe(false);
    expect(solved.canRequestCode).toBe(true);
  });

  it('does not wait for a captcha when none is required', () => {
    const controls = deriveOtpControls({
      ...base,
      captchaRequired: false,
      hasCaptchaToken: false,
    });

    expect(controls.canRequestCode).toBe(true);
  });

  it('blocks both buttons while a request is in flight', () => {
    const controls = deriveOtpControls({ ...base, isPending: true });

    expect(controls.canVerify).toBe(false);
    expect(controls.canRequestCode).toBe(false);
  });
});
