/** Generates six-digit codes using operating-system entropy and domain validation. */
import { randomInt } from 'node:crypto';
import { OtpCodeGenerator } from '@/application/auth/OtpCodeGenerator';
import { OtpCode } from '@/domain/otp/OtpCode';

export class CryptoOtpCodeGenerator implements OtpCodeGenerator {
  generate(): OtpCode {
    return OtpCode.fromString(randomInt(100000, 1000000).toString());
  }
}
