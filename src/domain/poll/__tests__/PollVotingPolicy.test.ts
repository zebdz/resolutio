import { describe, it, expect } from 'vitest';
import { Poll } from '../Poll';
import { Question } from '../Question';
import { Answer } from '../Answer';
import { PollVotingPolicy } from '../PollVotingPolicy';
import { PollDomainCodes } from '../PollDomainCodes';

function makeDraftPoll(pollType: 'ORGANIZATION' | 'OPEN'): Poll {
  const poll = Poll.create(
    'Title',
    'Description',
    'org-1',
    null,
    'user-admin',
    new Date('2026-01-01'),
    new Date('2026-02-01'),
    undefined,
    pollType
  ).value;

  const question = Question.create('Q1', 'poll-1', 1, 0, 'single-choice').value;
  question.addAnswer(Answer.create('A1', 1, 'question-1').value);
  poll.addQuestion(question);

  return poll;
}

function makeActivePoll(pollType: 'ORGANIZATION' | 'OPEN'): Poll {
  const poll = makeDraftPoll(pollType);
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
      expect(result.error).toBe(PollDomainCodes.NOT_PARTICIPANT);
    });

    it('rejects a participant who already finished voting', () => {
      const result = PollVotingPolicy.canVote(makeActivePoll('ORGANIZATION'), {
        isParticipant: true,
        isConfirmedUser: true,
        hasFinishedVoting: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.ALREADY_VOTED);
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
      expect(result.error).toBe(PollDomainCodes.USER_NOT_CONFIRMED);
    });

    it('rejects a user who already finished voting', () => {
      const result = PollVotingPolicy.canVote(makeActivePoll('OPEN'), {
        isParticipant: true,
        isConfirmedUser: true,
        hasFinishedVoting: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.ALREADY_VOTED);
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
      expect(result.error).toBe(PollDomainCodes.POLL_NOT_ACTIVE);
    });

    it('rejects a READY poll with POLL_NOT_ACTIVE', () => {
      const poll = makeDraftPoll('OPEN');
      poll.takeSnapshot();

      const result = PollVotingPolicy.canVote(poll, {
        ...noFacts,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_NOT_ACTIVE);
    });

    it('rejects a FINISHED poll with POLL_FINISHED', () => {
      const poll = makeActivePoll('OPEN');
      poll.finish();

      const result = PollVotingPolicy.canVote(poll, {
        ...noFacts,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_FINISHED);
    });
  });
});
