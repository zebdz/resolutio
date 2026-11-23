/** Validates canonical phone text without coercion before it becomes a contact value. */
import { UserDomainCodes } from './UserDomainCodes';

export const PHONE_NUMBER_REGEX = /^\+[1-9]\d{1,14}$/;

export class PhoneNumber {
  private constructor(private readonly value: string) {}

  static create(phoneNumber: string): PhoneNumber {
    // Validate phone number format: +<country code><number>
    // Example: +79161234567, +14155551234

    if (
      typeof phoneNumber !== 'string' ||
      !PHONE_NUMBER_REGEX.test(phoneNumber)
    ) {
      throw new Error(UserDomainCodes.PHONE_NUMBER_INVALID);
    }

    return new PhoneNumber(phoneNumber);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
