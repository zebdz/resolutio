/** Application-owned transaction boundary for participant snapshot changes.
 * The poll lock covers fresh reads, domain decisions and all requested writes. */
import { Poll } from '@/domain/poll/Poll';
import { PollId } from '@/domain/poll/PollValues';
import { PollDomainCode } from '@/domain/poll/PollDomainCodes';
import { PollWriteFailure } from '@/domain/poll/PollWriteFailure';
import { Result } from '@/domain/shared/Result';

export interface LockedPollSnapshot {
  readonly poll: Poll;
  hasVotes(): Promise<boolean>;
  savePoll(): Promise<void>;
  removeParticipantSnapshot(): Promise<void>;
}

export interface PollSnapshotTransaction {
  /** Load after locking the poll. Commit only on success; failures and thrown
   * errors roll back every write. The scope must not escape the callback. */
  withLockedPoll(
    pollId: PollId,
    work: (
      snapshot: LockedPollSnapshot
    ) => Promise<Result<void, PollDomainCode>>
  ): Promise<Result<void, PollWriteFailure>>;
}
