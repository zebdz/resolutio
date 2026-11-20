/** Consistent sealing unit of work. Adapters bind repositories to one database
 * snapshot and roll back failed results; the core never receives a DB client. */
import { PollRecordSnapshotReader } from './PollRecordSnapshotReader';
import { PollSealRepository } from '@/domain/seal/PollSealRepository';
import { SealPersistenceFailureCode } from '@/domain/seal/SealPersistenceFailureCode';
import { UtcTimestamp } from '@/domain/seal/SealValues';
import { Result } from '@/domain/shared/Result';
import { SealWorkClaim } from './SealWorkRepository';

export interface SealingScope {
  readonly snapshot: PollRecordSnapshotReader;
  readonly seals: PollSealRepository;
  readonly capturedAt: UtcTimestamp;
}
export interface SealingTransaction {
  run<T, E>(
    claim: SealWorkClaim,
    work: (scope: SealingScope) => Promise<Result<T, E>>
  ): Promise<Result<T, E | SealPersistenceFailureCode>>;
}
