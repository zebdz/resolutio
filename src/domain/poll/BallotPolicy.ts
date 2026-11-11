/** Whole-ballot invariants shared by transaction adapters. Inputs are facts
 * re-read under the poll lock, never an earlier authorization decision. */
import { failure, success, Result } from '../shared/Result';
import { PollDomainCodes as Codes, PollDomainCode } from './PollDomainCodes';
import { z } from 'zod';
import {
  BallotWeight,
  UserId,
  QuestionId,
  AnswerId,
  EQUAL_BALLOT_WEIGHT,
} from './PollValues';
import { PollState } from './PollState';
import { PollType } from './PollType';
import { QUESTION_TYPES } from './QuestionType';

export const VotingPollFacts = z
  .strictObject({
    state: z.enum(PollState),
    archived: z.boolean(),
    pollType: z.enum(PollType),
    questions: z
      .array(
        z
          .strictObject({
            id: QuestionId,
            questionType: z.enum(QUESTION_TYPES),
            answerIds: z.array(AnswerId).readonly(),
          })
          .readonly()
      )
      .readonly(),
  })
  .readonly();
export type VotingPollFacts = z.infer<typeof VotingPollFacts>;
export const BallotVoterFacts = z
  .strictObject({
    userId: UserId,
    weight: BallotWeight,
    participant: z.boolean(),
    confirmed: z.boolean(),
  })
  .readonly();
export type BallotVoterFacts = z.infer<typeof BallotVoterFacts>;
export const BallotSelectionFacts = z
  .strictObject({
    questionId: QuestionId,
    answerId: AnswerId,
    userId: UserId,
    weight: BallotWeight,
  })
  .readonly();
export type BallotSelectionFacts = z.infer<typeof BallotSelectionFacts>;
/** Decode external/legacy facts before invoking the typed domain policy. */
export const BallotFacts = z
  .strictObject({
    poll: VotingPollFacts,
    voter: BallotVoterFacts,
    votes: z.array(BallotSelectionFacts).readonly(),
  })
  .readonly();

export function validateBallot(
  poll: VotingPollFacts,
  voter: BallotVoterFacts,
  votes: readonly BallotSelectionFacts[]
): Result<void, PollDomainCode> {
  if (poll.state === PollState.FINISHED) {
    return failure(Codes.POLL_FINISHED);
  }

  if (poll.state !== PollState.ACTIVE || poll.archived) {
    return failure(Codes.POLL_NOT_ACTIVE);
  }

  if (poll.pollType === PollType.OPEN && !voter.confirmed) {
    return failure(Codes.USER_NOT_CONFIRMED);
  }

  if (poll.pollType === PollType.ORGANIZATION && !voter.participant) {
    return failure(Codes.NOT_PARTICIPANT);
  }

  if (poll.pollType === PollType.OPEN && voter.weight !== EQUAL_BALLOT_WEIGHT) {
    return failure(Codes.INVALID_WEIGHT);
  }

  const questions = new Map(poll.questions.map((q) => [q.id, q]));
  const selected = new Map<QuestionId, Set<AnswerId>>();

  for (const vote of votes) {
    const question = questions.get(vote.questionId);

    if (
      !question ||
      !question.answerIds.includes(vote.answerId) ||
      vote.userId !== voter.userId
    ) {
      return failure(Codes.INVALID_BALLOT);
    }

    if (vote.weight !== voter.weight) {
      return failure(Codes.INVALID_WEIGHT);
    }

    const answers = selected.get(vote.questionId) ?? new Set<AnswerId>();

    if (answers.has(vote.answerId)) {
      return failure(Codes.INVALID_BALLOT);
    }

    answers.add(vote.answerId);

    if (question.questionType === 'single-choice' && answers.size > 1) {
      return failure(Codes.SINGLE_CHOICE_MULTIPLE_ANSWERS);
    }

    selected.set(vote.questionId, answers);
  }

  if (questions.size === 0 || selected.size !== questions.size) {
    return failure(Codes.MUST_ANSWER_ALL_QUESTIONS);
  }

  return success(undefined);
}
