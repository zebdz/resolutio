/** Answer persistence port accepts validated identities and preserves aggregate state.
 * Database failures are represented by the shared unexpected-error code. */
import { AnswerId, QuestionId } from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import { Answer } from './Answer';
import { Result } from '../shared/Result';

export type AnswerRepositoryFailure = 'common.errors.unexpected';

export interface AnswerRepository {
  createAnswer(
    answer: Answer
  ): Promise<Result<Answer, AnswerRepositoryFailure>>;
  getAnswerById(
    answerId: AnswerId
  ): Promise<Result<Answer | null, AnswerRepositoryFailure>>;
  getAnswersByQuestionId(
    questionId: QuestionId
  ): Promise<Result<Answer[], AnswerRepositoryFailure>>;
  updateAnswer(answer: Answer): Promise<Result<void, AnswerRepositoryFailure>>;
  deleteAnswer(
    answerId: AnswerId,
    at: Instant
  ): Promise<Result<void, AnswerRepositoryFailure>>;
}
