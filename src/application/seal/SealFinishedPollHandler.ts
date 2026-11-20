/** Translates a committed poll event into the independent seal context.
 * A fresh worker identity per invocation prevents shared-process ownership ambiguity. */
import { PollFinished } from '@/domain/poll/PollFinished';
import { PollId } from '@/domain/seal/SealValues';
import { failure, success } from '@/domain/shared/Result';
import { IdGenerator } from '@/application/shared/EntityCreation';
import {
  PollFinishedHandler,
  PollFinishedFailureCode,
} from '@/application/poll/PollFinishedHandler';
import { SealPollUseCase } from './SealPollUseCase';
import { SealWorkOwner, SealLeaseSeconds } from './SealWorkRepository';
export class SealFinishedPollHandler implements PollFinishedHandler {
  constructor(
    private readonly seal: SealPollUseCase,
    private readonly ids: IdGenerator,
    private readonly lease: SealLeaseSeconds
  ) {}
  async handle(event: PollFinished): ReturnType<PollFinishedHandler['handle']> {
    const pollId = PollId.schema.safeParse(event.pollId);

    if (!pollId.success) {
      return failure(
        PollFinishedFailureCode.parse('domain.seal.inconsistentRecord')
      );
    }

    const result = await this.seal.execute({
      pollId: pollId.data,
      owner: this.ids.generate(SealWorkOwner),
      lease: this.lease,
    });

    if (!result.success) {
      return failure(PollFinishedFailureCode.parse(result.error));
    }

    return success(undefined);
  }
}
