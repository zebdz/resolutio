/** Verifies CAPTCHA through Turnstile and decodes the provider's explicit success flag.
 * Malformed responses and transport failures reject the challenge. */
import type { CaptchaVerifier } from '@/application/auth/CaptchaVerifier';
import { CaptchaChallenge } from '@/domain/auth/AuthValues';
import { z } from 'zod';

const TurnstileResponse = z.object({ success: z.boolean() });

export class TurnstileCaptchaVerifier implements CaptchaVerifier {
  constructor(private readonly secretKey: string) {}

  async verify(challenge: CaptchaChallenge): Promise<boolean> {
    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: this.secretKey,
            response: challenge.token,
            remoteip: challenge.clientIp,
          }),
        }
      );

      const data = TurnstileResponse.safeParse(await response.json());

      return data.success && data.data.success;
    } catch (error) {
      console.error('Turnstile verification error:', error);

      return false;
    }
  }
}
