/** Private sealing input port, scoped to the same snapshot as seal persistence.
 * Receipt secrets are consumed by the pure builder and never included in exports. */
import { PollId, UtcTimestamp } from '@/domain/seal/SealValues';
import { SealInput } from '@/domain/seal/SealInput';
import { SealPersistenceFailureCode } from '@/domain/seal/SealPersistenceFailureCode';
import { Result } from '@/domain/shared/Result';
export interface PollRecordSnapshotReader {
  read(
    pollId: PollId,
    capturedAt: UtcTimestamp
  ): Promise<Result<SealInput | null, SealPersistenceFailureCode>>;
}
