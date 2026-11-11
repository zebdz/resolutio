/** Accepted-selection persistence uses typed identities and explicit adapter failures.
 * The whole-ballot acceptance transaction remains the authoritative write boundary. */
import { PollId, UserId } from '../shared/EntityIds';
import { Vote } from './Vote';
import { Result } from '../shared/Result';

export type VoteRepositoryFailure = 'common.errors.unexpected';

export interface VoteRepository {
  createVote(vote: Vote): Promise<Result<Vote, VoteRepositoryFailure>>;
  createVotes(votes: Vote[]): Promise<Result<void, VoteRepositoryFailure>>;
  getUserVotes(
    pollId: PollId,
    userId: UserId
  ): Promise<Result<Vote[], VoteRepositoryFailure>>;
  hasUserFinishedVoting(
    pollId: PollId,
    userId: UserId
  ): Promise<Result<boolean, VoteRepositoryFailure>>;
  getVotesByPoll(
    pollId: PollId
  ): Promise<Result<Vote[], VoteRepositoryFailure>>;
  pollHasVotes(pollId: PollId): Promise<Result<boolean, VoteRepositoryFailure>>;
}
