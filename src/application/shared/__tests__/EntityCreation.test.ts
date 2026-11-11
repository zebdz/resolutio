/** Application creation inputs are complete before an aggregate is constructed.
 * Injected identity/time ports make creation deterministic in domain clients. */
import { expect, it } from 'vitest';
import { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { Clock, IdGenerator, entityCreation } from '../EntityCreation';

it('supplies validated identity and time together without mutable creation state', () => {
  const generatedId = '28ed98d3-5911-4d20-a4a5-214249b95372';
  const now = Instant.parse('2026-10-26T10:00:00.123Z');
  const ids: IdGenerator = {
    generate(identity) {
      return identity.parse(generatedId);
    },
  };
  const clock: Clock = { now: () => now };

  const creation = entityCreation(UserId, ids, clock);

  expect(creation).toEqual({ id: UserId.parse(generatedId), now });
  expect(Object.isFrozen(creation)).toBe(true);
  expect(() => Object.assign(creation, { now: 'changed' })).toThrow();
});
