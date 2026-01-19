import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { PollErrors } from './PollErrors';

interface FinishPollCommand {
  pollId: string;
  userId: string; // Admin user finishing the poll
}

export class FinishPollUseCase {
  constructor(private pollRepository: PollRepository) {}

  async execute(command: FinishPollCommand): Promise<Result<void, string>> {
    // Get the poll
    const pollResult = await this.pollRepository.getPollById(command.pollId);
    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;
    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // Mark poll as finished
    const finishResult = poll.finish();
    if (!finishResult.success) {
      return failure(finishResult.error);
    }

    // Save the finished poll
    const updateResult = await this.pollRepository.updatePoll(poll);
    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    // Clean up all remaining drafts for this poll
    const deleteDraftsResult = await this.pollRepository.deleteAllPollDrafts(
      command.pollId
    );

    if (!deleteDraftsResult.success) {
      // Log error but don't fail the operation
      console.error('Failed to delete poll drafts:', deleteDraftsResult.error);
    }

    return success(undefined);
  }
}
