/** Executes the aggregate's due anchor work with network calls outside transactions.
 * A second fenced transaction persists the outcome; expired workers cannot save late results. */
import { AnchorProvider } from '@/domain/seal/AnchorProvider';
import { AnchorSubmission, AnchorFailure } from '@/domain/seal/SealAnchor';
import { AnchorId, PollId, UtcTimestamp } from '@/domain/seal/SealValues';
import { SealDomainCode } from '@/domain/seal/SealDomainCodes';
import { SealPersistenceFailureCode } from '@/domain/seal/SealPersistenceFailureCode';
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { Result, failure, success } from '@/domain/shared/Result';
import { SealingTransaction } from './SealingTransaction';
import {
  SealWorkRepository,
  SealWorkClaim,
  SealWorkFailure,
  SealWorkOwner,
  SealLeaseSeconds,
} from './SealWorkRepository';

export interface AnchorSealCommand {
  readonly pollId: PollId;
  readonly owner: SealWorkOwner;
  readonly lease: SealLeaseSeconds;
  readonly source?: 'lazy';
}
export type AnchorWorkOutcome =
  | 'busy'
  | 'idle'
  | 'submitted'
  | 'failed'
  | 'pending'
  | 'confirmed';
export type AnchorWorkFailure =
  | SealDomainCode
  | SealWorkFailure
  | SealPersistenceFailureCode
  | 'seal.errors.notFound'
  | 'seal.errors.providerMismatch';
export class AnchorSealUseCase {
  constructor(
    private readonly work: SealWorkRepository,
    private readonly transaction: SealingTransaction,
    private readonly provider: AnchorProvider,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}
  async execute(
    command: AnchorSealCommand
  ): Promise<Result<AnchorWorkOutcome, AnchorWorkFailure>> {
    const acquired = await this.work.acquire(
      command.pollId,
      command.owner,
      command.lease,
      command.source
    );

    if (!acquired.success) {
      return acquired;
    }

    if (!acquired.value) {
      return success('busy');
    }

    const result = await this.runClaim(acquired.value);
    const released = await this.work.release(acquired.value);

    if (!result.success) {
      return result;
    }

    if (!released.success) {
      return released;
    }

    return result;
  }
  private async runClaim(
    claim: SealWorkClaim
  ): Promise<Result<AnchorWorkOutcome, AnchorWorkFailure>> {
    const loaded = await this.transaction.run(claim, (scope) =>
      scope.seals.findByPollId(claim.pollId)
    );

    if (!loaded.success) {
      return loaded;
    }

    if (!loaded.value) {
      return failure('seal.errors.notFound');
    }

    const seal = loaded.value;
    const plan = seal.anchorWork(UtcTimestamp.parse(this.clock.now()));

    if (!plan.success) {
      return plan;
    }

    const action = plan.value;

    if (action.kind === 'idle') {
      return success('idle');
    }

    const previous = action.kind === 'submit' ? action.previous : action.anchor;

    if (previous && previous.provider !== this.provider.name) {
      return failure('seal.errors.providerMismatch');
    }

    if (action.kind === 'upgrade') {
      const upgraded = await this.provider.upgrade(
        seal.rootDigest,
        action.anchor.pendingProof
      );
      const at = UtcTimestamp.parse(this.clock.now());
      const changed = !upgraded.success
        ? seal.deferAnchor(upgraded.error, at)
        : upgraded.value.kind === 'bitcoin'
          ? seal.confirmAnchor(upgraded.value, at)
          : seal.refreshAnchor(upgraded.value, at);

      if (!changed.success) {
        return changed;
      }

      const saved = await this.transaction.run(claim, (scope) =>
        scope.seals.saveAnchors(seal, claim.token)
      );

      if (!saved.success) {
        return saved;
      }

      return success(
        upgraded.success && upgraded.value.kind === 'bitcoin'
          ? 'confirmed'
          : 'pending'
      );
    }

    const id =
      action.kind === 'submit' && action.previous
        ? action.previous.id
        : this.ids.generate(AnchorId);
    const submission = await this.provider.submit(seal.rootDigest);
    const at = UtcTimestamp.parse(this.clock.now());
    const command: AnchorSubmission | AnchorFailure = submission.success
      ? { id, provider: this.provider.name, at, evidence: submission.value }
      : { id, provider: this.provider.name, at, error: submission.error };
    const changed =
      action.kind === 'replace'
        ? seal.supersedeAnchor(command)
        : 'evidence' in command
          ? seal.submitAnchor(command)
          : seal.failAnchor(command);

    if (!changed.success) {
      return changed;
    }

    const saved = await this.transaction.run(claim, (scope) =>
      scope.seals.saveAnchors(seal, claim.token)
    );

    if (!saved.success) {
      return saved;
    }

    return success(submission.success ? 'submitted' : 'failed');
  }
}
