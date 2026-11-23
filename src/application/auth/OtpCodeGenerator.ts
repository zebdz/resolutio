/** Supplies OTP entropy outside the deterministic domain. */
import { OtpCode } from '@/domain/otp/OtpCode';

export interface OtpCodeGenerator {
  generate(): OtpCode;
}
