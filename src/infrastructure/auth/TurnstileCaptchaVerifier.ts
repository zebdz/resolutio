import type { CaptchaVerifier } from '@/application/auth/CaptchaVerifier';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

export class TurnstileCaptchaVerifier implements CaptchaVerifier {
  constructor(private readonly secretKey: string) {}

  async verify(token: string, clientIp: string): Promise<boolean> {
    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: this.secretKey,
            response: token,
            remoteip: clientIp,
          }),
        }
      );

      const data: TurnstileResponse = await response.json();

      return data.success;
    } catch (error) {
      console.error('Turnstile verification error:', error);

      return false;
    }
  }
}
