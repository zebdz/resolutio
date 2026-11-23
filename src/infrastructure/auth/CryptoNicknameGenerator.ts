/** Produces the existing user_<eight hex digits> candidates for registration.
 * The domain validates each candidate; the application checks uniqueness. */
import { randomBytes } from 'node:crypto';
import { NicknameGenerator } from '@/application/auth/NicknameGenerator';
import { Nickname } from '@/domain/user/Nickname';

export class CryptoNicknameGenerator implements NicknameGenerator {
  generate(): Nickname {
    return Nickname.create(`user_${randomBytes(4).toString('hex')}`);
  }
}
