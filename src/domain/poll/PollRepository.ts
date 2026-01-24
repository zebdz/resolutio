import { Poll } from './Poll';
import { Result } from '../shared/Result';

export interface PollRepository {
  createPoll(poll: Poll): Promise<Result<Poll, string>>;
  getPollById(pollId: string): Promise<Result<Poll | null, string>>;
  getPollsByBoardId(boardId: string): Promise<Result<Poll[], string>>;
  getPollsByUserId(userId: string): Promise<Result<Poll[], string>>;
  updatePoll(poll: Poll): Promise<Result<void, string>>;
  deletePoll(pollId: string): Promise<Result<void, string>>;
}
