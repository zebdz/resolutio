import { UserDomainCodes } from './UserDomainCodes';

// RFC 5321 caps a full address at 254 characters.
export const EMAIL_MAX_LENGTH = 254;

// Deliberately stricter than the RFC and deliberately simple: one local part,
// one "@", a dotted domain with a real TLD. Exotic-but-legal addresses are
// rejected in exchange for catching the typos that would otherwise send a
// reset code to a stranger.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export class EmailAddress {
  private constructor(private readonly value: string) {}

  static create(raw: string): EmailAddress {
    const normalized = (raw ?? '').trim().toLowerCase();

    if (normalized.length === 0 || normalized.length > EMAIL_MAX_LENGTH) {
      throw new Error(UserDomainCodes.EMAIL_INVALID);
    }

    if (!EMAIL_REGEX.test(normalized)) {
      throw new Error(UserDomainCodes.EMAIL_INVALID);
    }

    return new EmailAddress(normalized);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: EmailAddress): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
