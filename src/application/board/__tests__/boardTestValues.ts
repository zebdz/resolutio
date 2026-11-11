/** Deterministic identity/time inputs for board application tests. Repositories
 * retain these values instead of mutating aggregates to imitate generated IDs. */
import { BoardId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';

export const boardCreation = {
  id: BoardId.parse('board-1'),
  now: Instant.parse('2026-10-26T12:00:00.000Z'),
};
export const boardArchiveTime = Instant.parse('2026-10-26T13:00:00.000Z');

export function createBoardIds(): IdGenerator {
  let nextId = 1;

  return { generate: (identity) => identity.parse(`board-${nextId++}`) };
}

export const boardClock: Clock = { now: () => boardCreation.now };
export const boardArchiveClock: Clock = { now: () => boardArchiveTime };
