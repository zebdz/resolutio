export interface CaptchaVerifier {
  verify(token: string, clientIp: string): Promise<boolean>;
}
