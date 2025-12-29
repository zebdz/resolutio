import { Poll } from './Poll';
import { Question } from './Question';
import { Answer } from './Answer';
import { Result } from '../shared/Result';

export interface UpdateQuestionOrderData {
  questionId: string;
  page: number;
  order: number;
}

export interface PollRepository {
  // Poll operations
  createPoll(poll: Poll): Promise<Result<Poll, string>>;
  getPollById(pollId: string): Promise<Result<Poll | null, string>>;
  getPollsByBoardId(boardId: string): Promise<Result<Poll[], string>>;
  getPollsByUserId(userId: string): Promise<Result<Poll[], string>>;
  updatePoll(poll: Poll): Promise<Result<void, string>>;
  deletePoll(pollId: string): Promise<Result<void, string>>;

  // Question operations
  createQuestion(question: Question): Promise<Result<Question, string>>;
  getQuestionById(questionId: string): Promise<Result<Question | null, string>>;
  getQuestionsByPollId(pollId: string): Promise<Result<Question[], string>>;
  updateQuestion(question: Question): Promise<Result<void, string>>;
  updateQuestionOrder(
    updates: UpdateQuestionOrderData[]
  ): Promise<Result<void, string>>;
  deleteQuestion(questionId: string): Promise<Result<void, string>>;

  // Answer operations
  createAnswer(answer: Answer): Promise<Result<Answer, string>>;
  getAnswerById(answerId: string): Promise<Result<Answer | null, string>>;
  getAnswersByQuestionId(questionId: string): Promise<Result<Answer[], string>>;
  updateAnswer(answer: Answer): Promise<Result<void, string>>;
  deleteAnswer(answerId: string): Promise<Result<void, string>>;
}
