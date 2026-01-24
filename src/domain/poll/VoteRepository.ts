import { Vote } from './Vote';
import { Result } from '../shared/Result';

export interface VoteRepository {
  createVote(vote: Vote): Promise<Result<Vote, string>>;
  createVotes(votes: Vote[]): Promise<Result<void, string>>;
  getUserVotes(pollId: string, userId: string): Promise<Result<Vote[], string>>;
  hasUserFinishedVoting(
    pollId: string,
    userId: string
  ): Promise<Result<boolean, string>>;
  getVotesByPoll(pollId: string): Promise<Result<Vote[], string>>;
  pollHasVotes(pollId: string): Promise<Result<boolean, string>>;
}
