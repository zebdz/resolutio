/** CAPTCHA verification accepts a decoded challenge and client address. */
import { CaptchaChallenge } from '@/domain/auth/AuthValues';

export interface CaptchaVerifier {
  verify(challenge: CaptchaChallenge): Promise<boolean>;
}
