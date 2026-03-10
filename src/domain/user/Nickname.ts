import { randomBytes } from 'crypto';
import { UserDomainCodes } from './UserDomainCodes';

export const NICKNAME_MIN_LENGTH = 5;
export const NICKNAME_MAX_LENGTH = 30;

export class Nickname {
  private constructor(private readonly value: string) {}

  static create(nickname: string): Nickname {
    if (!nickname || nickname.length < NICKNAME_MIN_LENGTH) {
      throw new Error(UserDomainCodes.NICKNAME_INVALID);
    }

    if (nickname.length > NICKNAME_MAX_LENGTH) {
      throw new Error(UserDomainCodes.NICKNAME_INVALID);
    }

    // Must start with a letter
    if (!/^[a-zA-Z]/.test(nickname)) {
      throw new Error(UserDomainCodes.NICKNAME_INVALID);
    }

    // Must not end with underscore
    if (nickname.endsWith('_')) {
      throw new Error(UserDomainCodes.NICKNAME_INVALID);
    }

    // Only alphanumeric and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
      throw new Error(UserDomainCodes.NICKNAME_INVALID);
    }

    // No consecutive underscores
    if (/_{2,}/.test(nickname)) {
      throw new Error(UserDomainCodes.NICKNAME_INVALID);
    }

    return new Nickname(nickname);
  }

  static generate(): Nickname {
    const suffix = randomBytes(4).toString('hex');

    return new Nickname(`user_${suffix}`);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Nickname): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
