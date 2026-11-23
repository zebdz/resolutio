/** Verifies entered passwords against opaque validated stored hashes.
 * Malformed persisted hash formats are treated as failed credentials. */
import { PasswordHash, PlaintextPassword } from '@/domain/user/UserValues';
import { compare } from 'bcryptjs';
import { UserId } from '@/domain/shared/EntityIds';
import { Argon2PasswordHasher } from './Argon2PasswordHasher';
import { verify } from '@node-rs/argon2';
import type { PasswordVerifier } from '@/application/auth/LoginUserUseCase';

export class Argon2PasswordVerifier implements PasswordVerifier {
  constructor(
    private readonly upgrade?: (
      id: UserId,
      expected: PasswordHash,
      replacement: PasswordHash
    ) => Promise<boolean>
  ) {}

  async verify(
    password: PlaintextPassword,
    hash: PasswordHash,
    userId?: UserId
  ): Promise<boolean> {
    if (hash.startsWith('bcrypt:')) {
      const bcrypt = hash.slice('bcrypt:'.length);

      if (
        !userId ||
        !this.upgrade ||
        !/^\$2y\$(0[4-9]|1[0-2])\$[./a-zA-Z0-9]{53}$/.test(bcrypt)
      ) {
        return false;
      }

      if (!(await compare(password, bcrypt))) {
        return false;
      }

      return this.upgrade(
        userId,
        hash,
        await new Argon2PasswordHasher().hash(password)
      );
    }

    try {
      // @node-rs/argon2 verify expects: verify(hash, password)
      // But our interface expects verify(password, hash)
      return await verify(hash, password);
    } catch {
      // If verification fails (e.g., invalid hash format), return false
      return false;
    }
  }
}
