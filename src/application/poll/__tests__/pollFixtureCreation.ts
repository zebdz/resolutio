import {
  PollParticipant,
  PollParticipantData,
} from '@/domain/poll/PollParticipant';
/** Deterministic identity and clock ports for legacy poll use-case scenarios.
 * Every aggregate is created with a real identity; repositories preserve it. */
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { EntityCreation } from '@/domain/shared/EntityCreation';
import { Instant } from '@/domain/shared/Instant';

let sequence = 0;
export const pollFixtureClock: Clock = {
  now: () => Instant.parse('2026-01-01T00:00:00.000Z'),
};
export const pollFixtureIds: IdGenerator = {
  generate: (schema) => schema.parse(`poll-fixture-${++sequence}`),
};

export function pollFixtureCreation<Id extends string>(
  schema: { parse(value: unknown): Id },
  now?: Date
): EntityCreation<Id> {
  return {
    id: pollFixtureIds.generate(schema),
    now: now ? Instant.fromDate(now) : pollFixtureClock.now(),
  };
}

/** Raw persistence fixture assembled only from the public participant interface. */
export function participantFixtureData(
  participant: PollParticipant
): PollParticipantData {
  return {
    id: participant.id,
    pollId: participant.pollId,
    userId: participant.userId,
    userWeight: participant.userWeight,
    willingToSignProtocol: participant.willingToSignProtocol,
    snapshotAt: participant.snapshotAt,
    createdAt: participant.createdAt,
    receiptSecret: participant.receiptSecret,
  };
}
