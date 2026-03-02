import { ValidationError } from '../shared/errors';
import { OtpDomainCodes } from './OtpDomainCodes';

// Value Object: OTP Code
export class OtpCode {
  private constructor(private readonly value: string) {}

  static generate(): OtpCode {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    return new OtpCode(code);
  }

  static fromString(code: string): OtpCode {
    const otpRegex = /^\d{6}$/;

    if (!otpRegex.test(code)) {
      throw new ValidationError(OtpDomainCodes.INVALID_CODE_FORMAT);
    }

    return new OtpCode(code);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: OtpCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
