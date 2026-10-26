/** Aggregate persistence port. Adapters preserve immutable record bytes and save
 * anchor changes atomically, rejecting stale worker fencing tokens. */
import { Result } from '../shared/Result';
import { PollSeal } from './PollSeal';
import { PollId, Digest, FencingToken } from './SealValues';

export interface PollSealRepository {
  save(seal: PollSeal): Promise<Result<void, string>>;
  findByPollId(pollId: PollId): Promise<Result<PollSeal | null, string>>;
  findByRootDigest(
    rootDigest: Digest
  ): Promise<Result<PollSeal | null, string>>;
  saveAnchors(
    seal: PollSeal,
    claimToken: FencingToken
  ): Promise<Result<void, string>>;
}
