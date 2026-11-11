/** Verifies entered passwords against opaque validated stored hashes.
 * Malformed persisted hash formats are treated as failed credentials. */
import { PasswordHash, PlaintextPassword } from '@/domain/user/UserValues';
import { verify } from '@node-rs/argon2';
import type { PasswordVerifier } from '@/application/auth/LoginUserUseCase';

export class Argon2PasswordVerifier implements PasswordVerifier {
  async verify(
    password: PlaintextPassword,
    hash: PasswordHash
  ): Promise<boolean> {
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
