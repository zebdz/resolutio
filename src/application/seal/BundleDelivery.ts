/** Prepare one voter export and durably claim its first SMTP handoff. Interrupted
 * or ambiguous sends become terminal; unclaimed work can resume after restart. */
import { z } from 'zod';
import { PollId, UserId } from '@/domain/seal/SealValues';
import { Result, success, failure } from '@/domain/shared/Result';
import { EvidenceMail, Recipient } from './EvidenceMail';
import { SealExports } from './SealExports';

export const DeliveryKey = z.object({
  pollId: PollId.schema,
  userId: UserId.schema,
});
export type DeliveryKey = z.infer<typeof DeliveryKey>;
export type DeliveryOutcome = 'SENT' | 'FAILED' | 'UNKNOWN';
type Stored<T> = Promise<Result<T, 'common.errors.unexpected'>>;
export interface BundleDeliveryStore {
  discover(limit: number, pollId?: PollId): Stored<DeliveryKey[]>;
  claim(key: DeliveryKey, recipient: Recipient): Stored<boolean>;
  complete(key: DeliveryKey, outcome: DeliveryOutcome): Stored<boolean>;
}

export class BundleDelivery {
  constructor(
    private readonly store: BundleDeliveryStore,
    private readonly mail: EvidenceMail,
    private readonly exports: Pick<SealExports, 'myProof' | 'proof'>
  ) {}
  async recover(limit: number, pollId?: PollId): Stored<number> {
    const keys = await this.store.discover(limit, pollId);

    if (!keys.success) {
      return keys;
    }

    if (this.mail.sender.previewOnly) {
      return success(0);
    }

    let sent = 0;
    let errored = false;

    for (const key of keys.value) {
      try {
        const delivered = await this.deliver(key);

        if (!delivered.success) {
          errored = true;
        } else if (delivered.value) {
          sent++;
        }
      } catch {
        // Continue the batch after an unexpected adapter failure. A claimed
        // handoff expires to UNKNOWN; unclaimed preparation remains discoverable.
        console.error('Bundle delivery interrupted');
        errored = true;
      }
    }

    return errored ? failure('common.errors.unexpected') : success(sent);
  }
  private async deliver(key: DeliveryKey): Stored<boolean> {
    const recipient = await this.mail.recipients.confirmed(key.userId);

    if (!recipient.success) {
      return recipient;
    }

    if (!recipient.value) {
      return success(false);
    }

    const message = await this.mail.bundle(
      this.exports,
      key.pollId,
      key.userId,
      recipient.value
    );

    if (!message.success) {
      if (message.error === 'seal.errors.anchorUnavailable') {
        return success(false);
      }

      return failure('common.errors.unexpected');
    }

    const claim = await this.store.claim(key, recipient.value);

    if (!claim.success || !claim.value) {
      return claim;
    }

    let outcome: DeliveryOutcome;

    try {
      const result = await this.mail.sender.send(message.value);
      outcome = result.success
        ? 'SENT'
        : result.uncertain
          ? 'UNKNOWN'
          : 'FAILED';
    } catch {
      outcome = 'UNKNOWN';
    }

    const saved = await this.store.complete(key, outcome);

    if (!saved.success) {
      return saved;
    }

    return success(saved.value && outcome === 'SENT');
  }
}
