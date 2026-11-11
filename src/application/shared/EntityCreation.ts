/** Application ports supply identity and time before aggregate construction.
 * Domain factories receive explicit values, with no empty-ID sentinel or I/O. */
import { Instant } from '@/domain/shared/Instant';
import { EntityCreation } from '@/domain/shared/EntityCreation';
export type { EntityCreation } from '@/domain/shared/EntityCreation';

export interface IdGenerator {
  generate<Id extends string>(identity: { parse(value: unknown): Id }): Id;
}

export interface Clock {
  now(): Instant;
}

export function entityCreation<Id extends string>(
  identity: { parse(value: unknown): Id },
  ids: IdGenerator,
  clock: Clock
): EntityCreation<Id> {
  return Object.freeze({ id: ids.generate(identity), now: clock.now() });
}
