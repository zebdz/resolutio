/** Whole-ballot acceptance through the domain API. A matching row count alone
 * must never accept foreign answers, duplicates, or a stale voter weight. */
import { describe, expect, it } from 'vitest';
import {
  validateBallot,
  VotingPollFacts,
  BallotVoterFacts,
  BallotSelectionFacts,
  BallotFacts,
} from '../BallotPolicy';
import { BallotWeight } from '../BallotSnapshot';
import { PollState } from '../PollState';
import { PollType } from '../PollType';
import { AnswerId, QuestionId, UserId } from '../PollValues';

const poll = VotingPollFacts.parse({
  state: PollState.ACTIVE,
  archived: false,
  pollType: PollType.ORGANIZATION,
  questions: [
    { id: 'q1', questionType: 'single-choice', answerIds: ['a1', 'a2'] },
    { id: 'q2', questionType: 'multiple-choice', answerIds: ['a3', 'a4'] },
  ],
});
const voter = BallotVoterFacts.parse({
  userId: 'u1',
  weight: BallotWeight.parse('1.000000'),
  participant: true,
  confirmed: true,
});
const votes = [
  BallotSelectionFacts.parse({
    questionId: 'q1',
    answerId: 'a1',
    userId: 'u1',
    weight: BallotWeight.parse('1.000000'),
  }),
  BallotSelectionFacts.parse({
    questionId: 'q2',
    answerId: 'a3',
    userId: 'u1',
    weight: BallotWeight.parse('1.000000'),
  }),
];

describe('ballot acceptance', () => {
  it('accepts exactly the active questions and their selected answers', () => {
    expect(validateBallot(poll, voter, votes).success).toBe(true);
    expect(
      validateBallot(poll, voter, [
        ...votes,
        { ...votes[1], answerId: AnswerId.parse('a4') },
      ]).success
    ).toBe(true);
  });
  it('rejects incomplete, foreign, duplicate and stale-weight ballots', () => {
    for (const ballot of [
      [],
      votes.slice(0, 1),
      [...votes, votes[1]],
      [votes[0], { ...votes[1], answerId: AnswerId.parse('a1') }],
      [votes[0], { ...votes[1], questionId: QuestionId.parse('foreign') }],
      [...votes, { ...votes[0], answerId: AnswerId.parse('a2') }],
      [votes[0], { ...votes[1], userId: UserId.parse('other') }],
      [votes[0], { ...votes[1], weight: BallotWeight.parse('2.000000') }],
    ]) {
      expect(validateBallot(poll, voter, ballot).success).toBe(false);
    }
  });
  it('accepts a non-unit organization weight and rejects it for an open poll', () => {
    const weight = BallotWeight.parse('12.345678');
    const weightedVotes = votes.map((v) => ({ ...v, weight }));
    expect(
      validateBallot(poll, { ...voter, weight }, weightedVotes).success
    ).toBe(true);
    expect(
      validateBallot(
        { ...poll, pollType: PollType.OPEN },
        { ...voter, weight },
        weightedVotes
      ).success
    ).toBe(false);
  });

  it('rejects unknown poll/question types at the facts boundary', () => {
    expect(
      BallotFacts.safeParse({
        poll: { ...poll, pollType: 'OTHER' },
        voter,
        votes,
      }).success
    ).toBe(false);
    expect(
      BallotFacts.safeParse({
        poll: {
          ...poll,
          questions: [{ ...poll.questions[0], questionType: 'unknown' }],
        },
        voter,
        votes,
      }).success
    ).toBe(false);
  });
});
