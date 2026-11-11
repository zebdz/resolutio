/** Preserves 256-bit session-token entropy independently of ordinary entity IDs. */
import { randomBytes } from 'node:crypto';
import { SessionId } from '@/domain/shared/EntityIds';
import { SessionTokenGenerator } from '@/application/auth/SessionTokenGenerator';

export class CryptoSessionTokenGenerator implements SessionTokenGenerator {
  generate(): SessionId {
    return SessionId.parse(randomBytes(32).toString('hex'));
  }
}
