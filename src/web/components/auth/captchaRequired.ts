/**
 * Whether an auth form must hold a Turnstile token before it will submit.
 *
 * TurnstileWidget renders nothing without a site key, so a form that insists
 * on a token in that case disables its own submit button forever — which is
 * what a local checkout hits when the key is left out of .env. Treat a missing
 * key as "captcha is off" instead.
 *
 * Only outside production, though. A site key missing from a production build
 * is a misconfiguration, and it must fail loudly — the button stays disabled —
 * rather than quietly switching off a security control because someone typo'd
 * an env var name.
 */
export function isCaptchaRequired(): boolean {
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}
