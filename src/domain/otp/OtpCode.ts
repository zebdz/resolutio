/** Validates immutable six-digit codes independently of cryptographic generation.
 * Randomness belongs to the application generator port and its infrastructure adapter. */
/** Six-digit code value; entropy is supplied by an application generator port. */
import { OtpDigits } from './OtpValues';
import { ValidationError } from '../shared/errors';
import { OtpDomainCodes } from './OtpDomainCodes';

// Value Object: OTP Code
export class OtpCode {
  private constructor(private readonly value: OtpDigits) {}

  static fromString(code: string): OtpCode {
    const parsed = OtpDigits.safeParse(code);

    if (!parsed.success) {
      throw new ValidationError(OtpDomainCodes.INVALID_CODE_FORMAT);
    }

    return new OtpCode(parsed.data);
  }

  getValue(): OtpDigits {
    return this.value;
  }

  equals(other: OtpCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
