import { Answer } from './Answer';
import { Result } from '../shared/Result';

export interface AnswerRepository {
  createAnswer(answer: Answer): Promise<Result<Answer, string>>;
  getAnswerById(answerId: string): Promise<Result<Answer | null, string>>;
  getAnswersByQuestionId(questionId: string): Promise<Result<Answer[], string>>;
  updateAnswer(answer: Answer): Promise<Result<void, string>>;
  deleteAnswer(answerId: string): Promise<Result<void, string>>;
}
