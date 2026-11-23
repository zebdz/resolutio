/** Production identity/time adapters. UUIDs are assigned before domain creation;
 * requested schemas validate them, while existing stored CUIDs remain valid. */
import { randomUUID } from 'node:crypto';
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { Instant } from '@/domain/shared/Instant';

export class CryptoIdGenerator implements IdGenerator {
  generate<Id extends string>(identity: { parse(value: unknown): Id }): Id {
    return identity.parse(randomUUID());
  }
}

export class SystemClock implements Clock {
  now(): Instant {
    return Instant.fromDate(new Date());
  }
}
