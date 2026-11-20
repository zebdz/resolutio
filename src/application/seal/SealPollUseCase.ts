/** Idempotently seals a finished poll using one private, consistent snapshot.
 * Claim ownership covers persistence; the domain builder owns record invariants. */
import { PollSeal } from '@/domain/seal/PollSeal';
import { SealedRecordBuilder } from '@/domain/seal/SealedRecordBuilder';
import { PollId } from '@/domain/seal/SealValues';
import { SealDomainCode } from '@/domain/seal/SealDomainCodes';
import { SealPersistenceFailureCode } from '@/domain/seal/SealPersistenceFailureCode';
import { Result, failure, success } from '@/domain/shared/Result';
import { SealingTransaction } from './SealingTransaction';
import {
  SealLeaseSeconds,
  SealWorkOwner,
  SealWorkRepository,
  SealWorkFailure,
} from './SealWorkRepository';

export type SealPollFailure =
  | SealWorkFailure
  | SealDomainCode
  | SealPersistenceFailureCode
  | 'poll.errors.pollNotFound';
export type SealPollOutcome =
  | { readonly status: 'sealed'; readonly seal: PollSeal }
  | { readonly status: 'busy' };
export interface SealPollCommand {
  readonly pollId: PollId;
  readonly owner: SealWorkOwner;
  readonly lease: SealLeaseSeconds;
}
export class SealPollUseCase {
  constructor(
    private readonly work: SealWorkRepository,
    private readonly transaction: SealingTransaction
  ) {}
  async execute(
    command: SealPollCommand
  ): Promise<Result<SealPollOutcome, SealPollFailure>> {
    const acquired = await this.work.acquire(
      command.pollId,
      command.owner,
      command.lease
    );

    if (!acquired.success) {
      return acquired;
    }

    const claim = acquired.value;

    if (!claim) {
      return success({ status: 'busy' });
    }

    const result = await this.transaction.run<SealPollOutcome, SealPollFailure>(
      claim,
      async (scope) => {
        const found = await scope.seals.findByPollId(command.pollId);

        if (!found.success) {
          return found;
        }

        if (found.value) {
          return success({ status: 'sealed', seal: found.value });
        }

        const snapshot = await scope.snapshot.read(
          command.pollId,
          scope.capturedAt
        );

        if (!snapshot.success) {
          return snapshot;
        }

        if (!snapshot.value) {
          return failure('poll.errors.pollNotFound');
        }

        const built = SealedRecordBuilder.build(
          snapshot.value,
          new Date(scope.capturedAt)
        );

        if (!built.success) {
          return built;
        }

        const saved = await scope.seals.save(built.value);

        if (!saved.success) {
          return saved;
        }

        // A uniqueness race must resolve to the stored bytes, never a rebuilt record.
        const stored = await scope.seals.findByPollId(command.pollId);

        if (!stored.success) {
          return stored;
        }

        if (!stored.value) {
          return failure('common.errors.unexpected');
        }

        return success({ status: 'sealed', seal: stored.value });
      }
    );
    const released = await this.work.release(claim);

    if (!result.success) {
      return result;
    }

    if (!released.success) {
      return released;
    }

    return result;
  }
}
