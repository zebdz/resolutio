/** Poll construction contracts: identities and time arrive from the caller;
 * loading stored records cannot bypass the same value constraints. */
import { PollPeriod } from '@/domain/poll/PollPeriod';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { expect, it } from 'vitest';
import { Poll } from '../Poll';
import { PollState } from '../PollState';
import { PollId, OrganizationId, UserId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { PollDomainCodes } from '../PollDomainCodes';
import { failure } from '../../shared/Result';
import { Question } from '../Question';

function storedPoll() {
  return {
    id: 'poll-1',
    title: 'Title',
    description: 'Description',
    organizationId: 'org-1',
    boardId: null,
    pollType: 'ORGANIZATION',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-01-02T00:00:00.000Z'),
    state: PollState.DRAFT,
    weightCriteria: null,
    distributionType: 'EQUAL',
    propertyAggregation: 'RAW_SUM',
    propertyIds: [],
    anonymous: false,
    createdBy: 'user-1',
    createdAt: new Date('2025-12-01T00:00:00.000Z'),
    archivedAt: null,
    questions: [],
  };
}

it('rejects missing persisted identity rather than constructing an unidentified poll', () => {
  expect(() => Poll.reconstitute({ ...storedPoll(), id: '' })).toThrow();
});

it('rejects persisted questions owned by another aggregate or duplicated in the aggregate', () => {
  const question = Question.reconstitute({
    id: 'question-1',
    pollId: 'poll-1',
    text: 'Question',
    details: null,
    page: 1,
    order: 0,
    questionType: 'single-choice',
    createdAt: new Date('2025-12-01T00:00:00.000Z'),
    archivedAt: null,
    answers: [],
  });
  expect(() =>
    Poll.reconstitute({ ...storedPoll(), id: 'poll-2', questions: [question] })
  ).toThrow(PollDomainCodes.QUESTION_INVALID_DATA);
  expect(() =>
    Poll.reconstitute({ ...storedPoll(), questions: [question, question] })
  ).toThrow(PollDomainCodes.QUESTION_INVALID_DATA);
});

it('creates with the caller identity and creation instant', () => {
  const creation = testCreation(PollId, 'caller-poll');
  const result = Poll.create(
    PollTitle.parse('Title'),
    PollDescription.parse('Description'),
    OrganizationId.parse('org-1'),
    null,
    UserId.parse('user-1'),
    expectSuccess(
      PollPeriod.create(storedPoll().startDate, storedPoll().endDate)
    ),
    creation
  );
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(result.value.id).toBe(creation.id);
  expect(result.value.createdAt.toISOString()).toBe(creation.now);
});

it('keeps stored dates and record arrays detached from mutable caller references', () => {
  const data = storedPoll();
  const poll = Poll.reconstitute(data);
  data.startDate.setUTCFullYear(2000);
  poll.endDate.setUTCFullYear(2000);
  poll.toJSON().createdAt.setUTCFullYear(2000);
  expect(poll.startDate.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  expect(poll.endDate.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  expect(poll.createdAt.toISOString()).toBe('2025-12-01T00:00:00.000Z');
});

it('rejects invalid and inverted poll periods before changing state', () => {
  const poll = Poll.reconstitute(storedPoll());
  // @ts-expect-error Runtime defense against an unchecked caller.
  expect(poll.updateDates(new Date(NaN))).toEqual(
    failure(PollDomainCodes.POLL_INVALID_DATES)
  );
  expect(poll.startDate).toEqual(storedPoll().startDate);
  expect(() =>
    Poll.reconstitute({ ...storedPoll(), endDate: new Date('2025-01-01') })
  ).toThrow(PollDomainCodes.POLL_INVALID_DATES);
});

it('applies a validated period atomically and keeps caller dates detached', () => {
  const poll = Poll.reconstitute(storedPoll());
  const start = new Date('2026-02-01T00:00:00.000Z');
  const end = new Date('2026-03-01T00:00:00.000Z');
  const period = expectSuccess(PollPeriod.create(start, end));
  start.setUTCFullYear(2030);
  end.setUTCFullYear(2000);
  expect(poll.updateDates(period)).toEqual({ success: true, value: undefined });
  expect(poll.startDate.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  expect(poll.endDate.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  expect(Object.isFrozen(period)).toBe(true);
});

it('does not rehydrate an open poll with board-only eligibility or weighted voting', () => {
  expect(() =>
    Poll.reconstitute({ ...storedPoll(), pollType: 'OPEN', boardId: 'board-1' })
  ).toThrow(PollDomainCodes.POLL_OPEN_CANNOT_BE_BOARD_SCOPED);
  expect(() =>
    Poll.reconstitute({
      ...storedPoll(),
      pollType: 'OPEN',
      distributionType: 'OWNERSHIP_UNIT_COUNT',
    })
  ).toThrow(PollDomainCodes.POLL_OPEN_MUST_BE_EQUAL);
});
