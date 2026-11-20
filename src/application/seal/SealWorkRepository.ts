/** Durable per-poll work ownership shared by immediate sealing and recovery workers.
 * A claim's owner and fencing token must be checked in the transaction saving its result. */
import { z } from 'zod';
import { identifier } from '@/domain/shared/Identifier';
import { PollId, FencingToken, UtcTimestamp } from '@/domain/seal/SealValues';
import { Result } from '@/domain/shared/Result';

export const SealWorkOwner = identifier(
  'SealWorkOwner',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type SealWorkOwner = z.infer<typeof SealWorkOwner>;
export const SealLeaseSeconds = z
  .number()
  .int()
  .positive()
  .max(2147483647)
  .brand<'SealLeaseSeconds'>();
export type SealLeaseSeconds = z.infer<typeof SealLeaseSeconds>;
export interface SealWorkClaim {
  readonly pollId: PollId;
  readonly owner: SealWorkOwner;
  readonly token: FencingToken;
  readonly leaseUntil: UtcTimestamp;
}
export type SealWorkFailure =
  | 'common.errors.unexpected'
  | 'seal.errors.claimLost';
export interface SealWorkRepository {
  acquire(
    pollId: PollId,
    owner: SealWorkOwner,
    duration: SealLeaseSeconds
  ): Promise<Result<SealWorkClaim | null, SealWorkFailure>>;
  release(claim: SealWorkClaim): Promise<Result<boolean, SealWorkFailure>>;
}
