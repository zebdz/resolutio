/** Deterministic identity/time ports keep editing fixtures independent of system I/O.
 * Generated IDs are unique across questions and answers within each test. */
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { Instant } from '@/domain/shared/Instant';

export const questionClock: Clock = {
  now: () => Instant.parse('2026-01-03T00:00:00.000Z'),
};

export function createQuestionIds(): IdGenerator {
  let next = 1;

  return { generate: (schema) => schema.parse(`created-${next++}`) };
}
