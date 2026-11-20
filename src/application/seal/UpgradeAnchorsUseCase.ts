/** Reconcile durable gaps between finishing, sealing, anchoring and first delivery.
 * Each item uses the same fenced operations as immediate finish and poll-specific nudges. */
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
  limit: number
) => Promise<Result<number, SealWorkFailure>>;
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

  async execute() {
    const items = await this.reader.discover(batchLimit);

    if (!items.success) {
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

    for (const item of items.value) {
      try {
        const result = await this.process(item);

        if (result.success) {
          counts[result.value]++;
        } else {
          counts.errors++;
          console.error('Seal recovery failed', item.pollId, result.error);
        }
      } catch {
        counts.errors++;
        console.error('Unexpected seal recovery failure', item.pollId);
      }
    }

    if (this.deliveries) {
      const delivered = await this.deliveries(batchLimit);

      if (!delivered.success) {
        return delivered;
      }

      counts.deliveries = delivered.value;
    }

    return success(counts);
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
