/** Question persistence port accepts validated identities and preserves aggregate state.
 * Database failures are represented by the shared unexpected-error code. */
import { PageNumber, SortOrder } from './QuestionValues';
import { QuestionId, PollId } from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import { Question } from './Question';
import { Result } from '../shared/Result';

export interface UpdateQuestionOrderData {
  questionId: QuestionId;
  page: PageNumber;
  order: SortOrder;
}

export type QuestionRepositoryFailure = 'common.errors.unexpected';

export interface QuestionRepository {
  createQuestion(
    question: Question
  ): Promise<Result<Question, QuestionRepositoryFailure>>;
  getQuestionById(
    questionId: QuestionId
  ): Promise<Result<Question | null, QuestionRepositoryFailure>>;
  getQuestionsByPollId(
    pollId: PollId
  ): Promise<Result<Question[], QuestionRepositoryFailure>>;
  updateQuestion(
    question: Question
  ): Promise<Result<void, QuestionRepositoryFailure>>;
  updateQuestionOrder(
    updates: UpdateQuestionOrderData[]
  ): Promise<Result<void, QuestionRepositoryFailure>>;
  deleteQuestion(
    questionId: QuestionId,
    at: Instant
  ): Promise<Result<void, QuestionRepositoryFailure>>;
}
