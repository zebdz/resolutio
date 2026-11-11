/** A draft must select a live answer in a live question of its poll.
 * The question supplies cardinality; request flags cannot change voting rules. */
import { Poll } from './Poll';
import { QuestionType } from './QuestionType';
import { AnswerId, QuestionId } from '../shared/EntityIds';
import { failure, Result, success } from '../shared/Result';
import { PollDomainCode, PollDomainCodes } from './PollDomainCodes';

export function validateDraftSelection(
  poll: Pick<Poll, 'questions'>,
  questionId: QuestionId,
  answerId: AnswerId
): Result<QuestionType, PollDomainCode> {
  const question = poll.questions.find(
    (candidate) => candidate.id === questionId && !candidate.isArchived()
  );

  if (
    !question ||
    !question.answers.some(
      (answer) => answer.id === answerId && !answer.isArchived()
    )
  ) {
    return failure(PollDomainCodes.INVALID_BALLOT);
  }

  return success(question.questionType);
}
