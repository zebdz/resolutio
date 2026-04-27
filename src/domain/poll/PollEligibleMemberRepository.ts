import { Result } from '../shared/Result';
import { PollEligibleMember } from './PollEligibleMember';

export interface PollEligibleMemberRepository {
  createMany(members: PollEligibleMember[]): Promise<Result<void, string>>;
  findByPollId(pollId: string): Promise<Result<PollEligibleMember[], string>>;
}
