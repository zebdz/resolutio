import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { PollErrors } from './PollErrors';

interface DeactivatePollCommand {
  pollId: string;
  userId: string; // Admin user deactivating the poll
}

export class DeactivatePollUseCase {
  constructor(private pollRepository: PollRepository) {}

  async execute(command: DeactivatePollCommand): Promise<Result<void, string>> {
    // Get the poll
    const pollResult = await this.pollRepository.getPollById(command.pollId);
    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;
    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // Deactivate the poll
    const deactivateResult = poll.deactivate();
    if (!deactivateResult.success) {
      return failure(deactivateResult.error);
    }

    // Save the updated poll
    const updateResult = await this.pollRepository.updatePoll(poll);
    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    return success(undefined);
  }
}
