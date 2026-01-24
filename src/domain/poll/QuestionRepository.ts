import { Question } from './Question';
import { Result } from '../shared/Result';

export interface UpdateQuestionOrderData {
  questionId: string;
  page: number;
  order: number;
}

export interface QuestionRepository {
  createQuestion(question: Question): Promise<Result<Question, string>>;
  getQuestionById(questionId: string): Promise<Result<Question | null, string>>;
  getQuestionsByPollId(pollId: string): Promise<Result<Question[], string>>;
  updateQuestion(question: Question): Promise<Result<void, string>>;
  updateQuestionOrder(
    updates: UpdateQuestionOrderData[]
  ): Promise<Result<void, string>>;
  deleteQuestion(questionId: string): Promise<Result<void, string>>;
}
