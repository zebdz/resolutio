/** Provider JSON must explicitly confirm CAPTCHA success before authentication proceeds. */
import { afterEach, expect, it, vi } from 'vitest';
import { CaptchaChallenge } from '@/domain/auth/AuthValues';
import { TurnstileCaptchaVerifier } from '../TurnstileCaptchaVerifier';

afterEach(() => vi.unstubAllGlobals());

it.each([true, false])(
  'preserves the provider outcome %s and sends decoded challenge fields',
  async (success) => {
    const fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success, hostname: 'example.org' }),
    });
    vi.stubGlobal('fetch', fetch);
    const challenge = CaptchaChallenge.parse({
      token: 'opaque-token',
      clientIp: '127.0.0.1',
    });
    expect(
      await new TurnstileCaptchaVerifier('test-secret').verify(challenge)
    ).toBe(success);
    const requestBody = fetch.mock.calls[0][1].body;
    expect(requestBody.get('response')).toBe('opaque-token');
    expect(requestBody.get('remoteip')).toBe('127.0.0.1');
  }
);

it.each([
  { token: '', clientIp: '127.0.0.1' },
  { token: 123, clientIp: '127.0.0.1' },
  { token: 'opaque-token', clientIp: 'not-an-ip' },
])('rejects malformed challenge inputs: %j', (challenge) => {
  expect(CaptchaChallenge.safeParse(challenge).success).toBe(false);
});

it.each([{ success: 'true' }, {}, { success: 1 }])(
  'rejects malformed verification outcomes: %j',
  async (body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: async () => body })
    );
    const result = await new TurnstileCaptchaVerifier('test-secret').verify(
      CaptchaChallenge.parse({ token: 'challenge', clientIp: '127.0.0.1' })
    );
    expect(result).toBe(false);
  }
);
