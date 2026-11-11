/** Poll read and voting eligibility rules using persisted polls and real lifecycle transitions. */
import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { PollInstant } from '@/domain/poll/PollValues';
import { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
import { PageNumber, SortOrder } from '@/domain/poll/QuestionValues';
import { UserId } from '@/domain/shared/EntityIds';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { OrganizationId } from '@/domain/shared/EntityIds';
import { expectFailure } from '@/domain/shared/__tests__/resultAssertions';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PollId, QuestionId, AnswerId } from '@/domain/shared/EntityIds';
import { describe, it, expect } from 'vitest';
import { Poll } from '../Poll';
import { Question } from '../Question';
import { Answer } from '../Answer';
import { PollVotingPolicy } from '../PollVotingPolicy';
import { PollReadPolicy } from '../PollReadPolicy';
import { PollDomainCodes } from '../PollDomainCodes';

function makeDraftPoll(pollType: 'ORGANIZATION' | 'OPEN'): Poll {
  const created = expectSuccess(
    Poll.create(
      PollTitle.parse('Title'),
      PollDescription.parse('Description'),
      OrganizationId.parse('org-1'),
      null,
      UserId.parse('user-admin'),
      expectSuccess(
        PollPeriod.create(new Date('2026-01-01'), new Date('2026-02-01'))
      ),
      testCreation(PollId, 'poll-1'),
      undefined,
      pollType
    )
  );
  const poll = Poll.reconstitute({
    ...created.toJSON(),
    id: 'poll-1',
    questions: created.questions,
  });

  const question = expectSuccess(
    Question.create(
      QuestionText.parse('Q1'),
      PollId.parse('poll-1'),
      testCreation(QuestionId, 'question-1'),
      PageNumber.parse(1),
      SortOrder.parse(0),
      'single-choice'
    )
  );
  question.addAnswer(
    expectSuccess(
      Answer.create(
        AnswerText.parse('A1'),
        SortOrder.parse(1),
        QuestionId.parse('question-1'),
        testCreation(AnswerId, 'answer-1')
      )
    )
  );
  poll.addQuestion(question);

  return poll;
}

describe('PollReadPolicy', () => {
  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
  ])(
    'uses existing organization access: admin=%s member=%s',
    (isAdmin, isOrgMember, allowed) => {
      expect(
        PollReadPolicy.canViewPoll(makeDraftPoll('ORGANIZATION'), {
          isAdmin,
          isOrgMember,
        })
      ).toBe(allowed);
    }
  );
  it('lets an authenticated link holder read an open poll', () => {
    expect(
      PollReadPolicy.canViewPoll(makeDraftPoll('OPEN'), {
        isAdmin: false,
        isOrgMember: false,
      })
    ).toBe(true);
  });
});

function makeActivePoll(pollType: 'ORGANIZATION' | 'OPEN'): Poll {
  const poll = makeDraftPoll(pollType);
  poll.submitToAdmin();
  poll.takeSnapshot();
  poll.activate();

  return poll;
}

const noFacts = {
  isParticipant: false,
  isConfirmedUser: false,
  hasFinishedVoting: false,
};

describe('PollVotingPolicy.canVote', () => {
  describe('organization poll', () => {
    it('allows a participant on an active poll', () => {
      const result = PollVotingPolicy.canVote(makeActivePoll('ORGANIZATION'), {
        ...noFacts,
        isParticipant: true,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(true);
    });

    it('rejects a non-participant even when confirmed', () => {
      const result = PollVotingPolicy.canVote(makeActivePoll('ORGANIZATION'), {
        ...noFacts,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollDomainCodes.NOT_PARTICIPANT);
    });

    it('rejects a participant who already finished voting', () => {
      const result = PollVotingPolicy.canVote(makeActivePoll('ORGANIZATION'), {
        isParticipant: true,
        isConfirmedUser: true,
        hasFinishedVoting: true,
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollDomainCodes.ALREADY_VOTED);
    });
  });

  describe('open poll', () => {
    it('allows any confirmed user who is not a participant yet', () => {
      const result = PollVotingPolicy.canVote(makeActivePoll('OPEN'), {
        ...noFacts,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(true);
    });

    it('rejects an unconfirmed user', () => {
      const result = PollVotingPolicy.canVote(makeActivePoll('OPEN'), noFacts);

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollDomainCodes.USER_NOT_CONFIRMED);
    });

    it('rejects a user who already finished voting', () => {
      const result = PollVotingPolicy.canVote(makeActivePoll('OPEN'), {
        isParticipant: true,
        isConfirmedUser: true,
        hasFinishedVoting: true,
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollDomainCodes.ALREADY_VOTED);
    });
  });

  describe('poll state gates both types', () => {
    it('rejects a DRAFT poll with POLL_NOT_ACTIVE', () => {
      const result = PollVotingPolicy.canVote(makeDraftPoll('ORGANIZATION'), {
        ...noFacts,
        isParticipant: true,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollDomainCodes.POLL_NOT_ACTIVE);
    });

    it('rejects a READY poll with POLL_NOT_ACTIVE', () => {
      const poll = makeDraftPoll('OPEN');
      poll.submitToAdmin();
      poll.takeSnapshot();

      const result = PollVotingPolicy.canVote(poll, {
        ...noFacts,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollDomainCodes.POLL_NOT_ACTIVE);
    });

    it('rejects a FINISHED poll with POLL_FINISHED', () => {
      const poll = makeActivePoll('OPEN');
      expect(
        poll.finish(PollInstant.parse(new Date().toISOString())).success
      ).toBe(true);

      const result = PollVotingPolicy.canVote(poll, {
        ...noFacts,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollDomainCodes.POLL_FINISHED);
    });
  });
});
