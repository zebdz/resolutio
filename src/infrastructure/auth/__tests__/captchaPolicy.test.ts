/** CAPTCHA policy scenarios isolate environment changes and restore them after each test. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isCaptchaEnforced } from '../captchaPolicy';

const SECRET = 'TURNSTILE_SECRET_KEY';

describe('isCaptchaEnforced', () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env[SECRET];
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env[SECRET];
    } else {
      process.env[SECRET] = originalSecret;
    }

    vi.unstubAllEnvs();
  });

  it('enforces whenever a secret makes verification possible', () => {
    process.env[SECRET] = '0x4AAAAAAA_secret';

    for (const nodeEnv of ['development', 'test', 'production']) {
      vi.stubEnv('NODE_ENV', nodeEnv);
      expect(isCaptchaEnforced()).toBe(true);
    }
  });

  // Without a secret every verify() call would fail, so demanding a token
  // outside production would make local login impossible.
  it('does not enforce outside production when no secret is configured', () => {
    delete process.env[SECRET];
    vi.stubEnv('NODE_ENV', 'development');

    expect(isCaptchaEnforced()).toBe(false);
  });

  // Fails closed: a secret missing from a deployment must surface as blocked
  // logins, never as a silently disabled control.
  it('enforces in production even when the secret is missing', () => {
    delete process.env[SECRET];
    vi.stubEnv('NODE_ENV', 'production');

    expect(isCaptchaEnforced()).toBe(true);
  });

  it('treats an empty secret as absent', () => {
    process.env[SECRET] = '';
    vi.stubEnv('NODE_ENV', 'development');

    expect(isCaptchaEnforced()).toBe(false);
  });
});
