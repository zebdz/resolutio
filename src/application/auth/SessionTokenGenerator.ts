/** Session credentials require a dedicated cryptographic token source, not entity UUIDs. */
import { SessionId } from '@/domain/shared/EntityIds';

export interface SessionTokenGenerator {
  generate(): SessionId;
}
