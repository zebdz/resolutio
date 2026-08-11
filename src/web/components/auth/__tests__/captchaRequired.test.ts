import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isCaptchaRequired } from '../captchaRequired';

const SITE_KEY = 'NEXT_PUBLIC_TURNSTILE_SITE_KEY';

describe('isCaptchaRequired', () => {
  let originalKey: string | undefined;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalKey = process.env[SITE_KEY];
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env[SITE_KEY];
    } else {
      process.env[SITE_KEY] = originalKey;
    }

    process.env.NODE_ENV = originalEnv;
  });

  it('requires a token whenever a site key is configured', () => {
    process.env[SITE_KEY] = '0x4AAAAAAA';

    for (const nodeEnv of ['development', 'test', 'production']) {
      process.env.NODE_ENV = nodeEnv;
      expect(isCaptchaRequired()).toBe(true);
    }
  });

  // Without a key TurnstileWidget renders nothing, so a required token would
  // leave every auth form permanently unsubmittable.
  it('drops the requirement outside production when no site key is set', () => {
    delete process.env[SITE_KEY];
    process.env.NODE_ENV = 'development';

    expect(isCaptchaRequired()).toBe(false);
  });

  // A missing key in production is a misconfiguration, not an opt-out: fail
  // closed so it surfaces, rather than silently disabling the check.
  it('still requires a token in production when the site key is missing', () => {
    delete process.env[SITE_KEY];
    process.env.NODE_ENV = 'production';

    expect(isCaptchaRequired()).toBe(true);
  });

  it('treats an empty site key as absent', () => {
    process.env[SITE_KEY] = '';
    process.env.NODE_ENV = 'development';

    expect(isCaptchaRequired()).toBe(false);
  });
});
