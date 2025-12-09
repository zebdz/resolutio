import { verify } from '@node-rs/argon2';
import type { PasswordVerifier } from '@/application/auth/LoginUserUseCase';

export class Argon2PasswordVerifier implements PasswordVerifier {
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      // @node-rs/argon2 verify expects: verify(hash, password)
      return await verify(hash, password);
    } catch {
      // If verification fails (e.g., invalid hash format), return false
      return false;
    }
  }
}
