import { randomBytes } from 'crypto';

export const NICKNAME_MIN_LENGTH = 5;
export const NICKNAME_MAX_LENGTH = 20;

export class Nickname {
  private constructor(private readonly value: string) {}

  static create(nickname: string): Nickname {
    if (!nickname || nickname.length < NICKNAME_MIN_LENGTH) {
      throw new Error(
        `Nickname must be at least ${NICKNAME_MIN_LENGTH} characters`
      );
    }

    if (nickname.length > NICKNAME_MAX_LENGTH) {
      throw new Error(
        `Nickname must be at most ${NICKNAME_MAX_LENGTH} characters`
      );
    }

    // Must start with a letter
    if (!/^[a-zA-Z]/.test(nickname)) {
      throw new Error('Nickname must start with a letter');
    }

    // Must not end with underscore
    if (nickname.endsWith('_')) {
      throw new Error('Nickname cannot end with an underscore');
    }

    // Only alphanumeric and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
      throw new Error(
        'Nickname can only contain letters, numbers, and underscores'
      );
    }

    // No consecutive underscores
    if (/_{2,}/.test(nickname)) {
      throw new Error('Nickname cannot have consecutive underscores');
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
