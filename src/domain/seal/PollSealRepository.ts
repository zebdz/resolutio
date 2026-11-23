/** Aggregate persistence port. Adapters preserve immutable record bytes and save
 * anchor changes atomically, rejecting stale worker fencing tokens. */
import { Result } from '../shared/Result';
import { PollSeal } from './PollSeal';
import { PollId, Digest, FencingToken } from './SealValues';
import { SealPersistenceFailureCode } from './SealPersistenceFailureCode';

export interface PollSealRepository {
  save(seal: PollSeal): Promise<Result<void, SealPersistenceFailureCode>>;
  findByPollId(
    pollId: PollId
  ): Promise<Result<PollSeal | null, SealPersistenceFailureCode>>;
  findByRootDigest(
    rootDigest: Digest
  ): Promise<Result<PollSeal | null, SealPersistenceFailureCode>>;
  saveAnchors(
    seal: PollSeal,
    claimToken: FencingToken
  ): Promise<Result<void, SealPersistenceFailureCode>>;
}
