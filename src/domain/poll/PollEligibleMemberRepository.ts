/** Eligibility snapshots use validated poll references and stable persistence errors. */
import { PollId } from '../shared/EntityIds';
import { PollWriteFailure } from './PollWriteFailure';
import { Result } from '../shared/Result';
import { PollEligibleMember } from './PollEligibleMember';

export interface PollEligibleMemberRepository {
  createMany(
    members: PollEligibleMember[]
  ): Promise<Result<void, PollWriteFailure>>;
  findByPollId(
    pollId: PollId
  ): Promise<Result<PollEligibleMember[], PollWriteFailure>>;
}
