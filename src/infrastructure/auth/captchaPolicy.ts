/**
 * Whether a server action must be handed a CAPTCHA token before it will do
 * any work.
 *
 * The verification call sites used to read "verify the token if one was sent",
 * which made the control optional: a client that simply omitted the field
 * skipped it entirely. Enforcement has to be decided by the server alone, from
 * the secret only the server holds.
 *
 * Keyed on TURNSTILE_SECRET_KEY rather than the public site key, because the
 * secret is what makes verification possible at all — without it every
 * verify() call would fail and no one could log in. In production the token is
 * required regardless, so a secret missing from a deployment fails closed and
 * visibly instead of quietly disabling the check.
 *
 * The client-side counterpart is isCaptchaRequired() in
 * src/web/components/auth/captchaRequired.ts, which keys on the public site
 * key because that is all a browser bundle can see.
 */
export function isCaptchaEnforced(): boolean {
  if (process.env.TURNSTILE_SECRET_KEY) {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}
