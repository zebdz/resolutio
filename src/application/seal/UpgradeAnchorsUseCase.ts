/** Reconcile durable gaps between finishing, sealing, anchoring and first delivery.
 * Report each processed poll under its outcome in the private scheduler summary. */
import { success, Result } from '@/domain/shared/Result';
import { PollId } from '@/domain/seal/SealValues';
import { IdGenerator } from '@/application/shared/EntityCreation';
import {
  AnchorSealUseCase,
  AnchorWorkOutcome,
  AnchorWorkFailure,
} from './AnchorSealUseCase';
import { SealPollUseCase, SealPollFailure } from './SealPollUseCase';
import {
  SealLeaseSeconds,
  SealWorkOwner,
  SealRecoveryReader,
  RecoveryItem,
  SealWorkFailure,
} from './SealWorkRepository';

type Outcome = Result<AnchorWorkOutcome, AnchorWorkFailure | SealPollFailure>;
type DeliveryRecovery = (
  limit: number,
  pollId?: PollId
) => Promise<Result<number, SealWorkFailure>>;
export interface SealRecoveryIssue {
  readonly pollId?: PollId;
  readonly operation:
    | RecoveryItem['kind']
    | 'discover'
    | 'deliveries'
    | 'nudge';
  readonly code:
    | AnchorWorkFailure
    | SealPollFailure
    | 'seal.errors.anchorSubmissionFailed';
}

type ReportIssue = (issue: SealRecoveryIssue) => void | Promise<void>;
const batchLimit = 20;
export class UpgradeAnchorsUseCase {
  constructor(
    private readonly reader: SealRecoveryReader,
    private readonly seal: Pick<SealPollUseCase, 'execute'>,
    private readonly anchor: Pick<AnchorSealUseCase, 'execute'>,
    private readonly ids: IdGenerator,
    private readonly lease: SealLeaseSeconds,
    private readonly deliveries?: DeliveryRecovery
  ) {}

  async execute(
    reportIssue: ReportIssue = (issue) =>
      console.error('Seal recovery failed', issue)
  ) {
    const items = await this.reader.discover(batchLimit);

    if (!items.success) {
      await reportIssue({ operation: 'discover', code: items.error });

      return items;
    }

    const counts = {
      submitted: 0,
      confirmed: 0,
      pending: 0,
      failed: 0,
      idle: 0,
      busy: 0,
      errors: 0,
      deliveries: 0,
    };

    const pollIds: Partial<Record<AnchorWorkOutcome | 'errors', PollId[]>> = {};

    for (const item of items.value) {
      let result: Outcome;

      try {
        result = await this.process(item);
      } catch {
        result = { success: false, error: 'common.errors.unexpected' };
      }

      const outcome = result.success ? result.value : 'errors';
      counts[outcome]++;
      (pollIds[outcome] ??= []).push(item.pollId);

      if (!result.success) {
        await reportIssue({
          pollId: item.pollId,
          operation: item.kind,
          code: result.error,
        });
        continue;
      }

      if (result.value === 'failed') {
        await reportIssue({
          pollId: item.pollId,
          operation: 'anchor',
          code: 'seal.errors.anchorSubmissionFailed',
        });
      }
    }

    if (this.deliveries) {
      const delivered = await this.deliveries(batchLimit);

      if (!delivered.success) {
        await reportIssue({ operation: 'deliveries', code: delivered.error });

        return delivered;
      }

      counts.deliveries = delivered.value;
    }

    return success({ ...counts, pollIds });
  }

  async deliverForPoll(pollId: PollId) {
    return this.deliveries ? this.deliveries(batchLimit, pollId) : success(0);
  }

  async nudge(pollId: PollId): Promise<Outcome> {
    const items = await this.reader.discover(1, pollId);

    if (!items.success) {
      return items;
    }

    return items.value[0]
      ? this.process(items.value[0], 'lazy')
      : success('idle');
  }

  async process(item: RecoveryItem, source?: 'lazy'): Promise<Outcome> {
    const command = {
      pollId: item.pollId,
      owner: this.ids.generate(SealWorkOwner),
      lease: this.lease,
    };

    if (item.kind === 'seal') {
      const sealed = await this.seal.execute({ ...command, source });

      if (!sealed.success) {
        return sealed;
      }

      if (sealed.value.status === 'busy') {
        return success('busy');
      }
    }

    // A lazy nudge takes admission only once, even if it crosses both durable boundaries.
    return this.anchor.execute({
      ...command,
      source: item.kind === 'anchor' ? source : undefined,
    });
  }
}
