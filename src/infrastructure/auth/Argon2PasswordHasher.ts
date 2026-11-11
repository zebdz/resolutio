/** Converts the hashing library result into the core's opaque stored credential. */
import { PasswordHash, PlaintextPassword } from '@/domain/user/UserValues';
import { hash } from '@node-rs/argon2';
import type { PasswordHasher } from '@/application/auth/RegisterUserUseCase';

export class Argon2PasswordHasher implements PasswordHasher {
  async hash(password: PlaintextPassword): Promise<PasswordHash> {
    // Using argon2id variant (most secure)
    // These are the recommended settings from OWASP
    return PasswordHash.parse(
      await hash(password, {
        memoryCost: 19456, // 19 MiB
        timeCost: 2, // 2 iterations
        outputLen: 32, // 32 bytes
        parallelism: 1, // 1 thread
      })
    );
  }
}
