/** Translates a committed poll event into the independent seal context.
 * Immediate sealing and submission share the same fenced path as recovery. */
import { PollFinished } from '@/domain/poll/PollFinished';
import { PollId } from '@/domain/seal/SealValues';
import { failure, success } from '@/domain/shared/Result';
import {
  PollFinishedHandler,
  PollFinishedFailureCode,
} from '@/application/poll/PollFinishedHandler';
import { UpgradeAnchorsUseCase } from './UpgradeAnchorsUseCase';
export class SealFinishedPollHandler implements PollFinishedHandler {
  constructor(
    private readonly recovery: () => Pick<UpgradeAnchorsUseCase, 'process'>
  ) {}
  async handle(event: PollFinished): ReturnType<PollFinishedHandler['handle']> {
    const pollId = PollId.schema.safeParse(event.pollId);

    if (!pollId.success) {
      return failure(
        PollFinishedFailureCode.parse('domain.seal.inconsistentRecord')
      );
    }

    const result = await this.recovery().process({
      kind: 'seal',
      pollId: pollId.data,
    });

    if (!result.success) {
      return failure(PollFinishedFailureCode.parse(result.error));
    }

    return success(undefined);
  }
}
