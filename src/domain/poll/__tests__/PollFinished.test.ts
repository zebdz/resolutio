/** Client contracts for validated finish identity/time and atomic event creation.
 * Rehydration never invents an event or a timestamp for a legacy finished poll. */
import { describe, expect, it } from 'vitest';
import { Poll } from '../Poll';
import { PollState } from '../PollState';
import { PollDomainCodes } from '../PollDomainCodes';
import { failure } from '../../shared/Result';
import { PollInstant } from '../PollValues';

export function activePoll() {
  return Poll.reconstitute({
    id: 'poll-1',
    title: 'Poll',
    description: 'Description',
    organizationId: 'org-1',
    boardId: null,
    pollType: 'ORGANIZATION',
    startDate: new Date('2026-01-01Z'),
    endDate: new Date('2026-12-31Z'),
    state: PollState.ACTIVE,
    weightCriteria: null,
    distributionType: 'EQUAL',
    propertyAggregation: 'RAW_SUM',
    propertyIds: [],
    anonymous: false,
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01Z'),
    archivedAt: null,
    questions: [],
  });
}

describe('finishing a poll', () => {
  it.each(['', 'invalid id'])(
    'rejects an invalid identity %j before a poll can enter the domain',
    (id) => {
      expect(() =>
        Poll.reconstitute({
          ...activePoll().toJSON(),
          id,
          questions: [],
        })
      ).toThrow();
    }
  );

  it.each([new Date(NaN), new Date('+010000-01-01T00:00:00.000Z')])(
    'rejects an invalid finish instant %s at both transition and rehydration boundaries',
    (finishedAt) => {
      const poll = activePoll();

      // @ts-expect-error Runtime malformed values must still fail without emitting an event.
      expect(poll.finish(finishedAt)).toEqual(
        failure(PollDomainCodes.POLL_INVALID_DATES)
      );
      expect(poll.state).toBe(PollState.ACTIVE);
      expect(poll.finishedAt).toBeNull();
      expect(poll.pullDomainEvents()).toEqual([]);
      expect(() =>
        Poll.reconstitute({
          ...poll.toJSON(),
          questions: [],
          state: PollState.FINISHED,
          finishedAt,
        })
      ).toThrow(PollDomainCodes.POLL_INVALID_DATES);
    }
  );

  it('rehydrates without events and rejects a finish time on an unfinished poll', () => {
    const props = activePoll().toJSON();
    const finishedAt = new Date('2026-10-26T10:00:00.123Z');
    const saved = Poll.reconstitute({
      ...props,
      questions: [],
      state: PollState.FINISHED,
      finishedAt,
    });
    expect(saved.finishedAt).toEqual(finishedAt);
    expect(saved.pullDomainEvents()).toEqual([]);
    expect(
      Poll.reconstitute({ ...props, questions: [], state: PollState.FINISHED })
        .finishedAt
    ).toBeNull();
    expect(() =>
      Poll.reconstitute({ ...props, questions: [], finishedAt })
    ).toThrow();
  });
  it('captures the supplied time once and emits one immutable event', () => {
    const poll = activePoll();
    const source = new Date('2026-10-26T10:00:00.123Z');
    const now = PollInstant.parse(source.toISOString());
    expect(poll.finish(now).success).toBe(true);
    source.setFullYear(2000);
    expect(poll.finishedAt?.toISOString()).toBe('2026-10-26T10:00:00.123Z');
    expect(poll.finish(now).success).toBe(false);
    expect(poll.pullDomainEvents()).toEqual([
      {
        type: 'PollFinished',
        pollId: 'poll-1',
        finishedAt: '2026-10-26T10:00:00.123Z',
      },
    ]);
    expect(poll.pullDomainEvents()).toEqual([]);
  });
});
