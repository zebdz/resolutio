import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { PollErrors } from './PollErrors';

export interface UpdatePollInput {
  pollId: string;
  userId: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
}

export class UpdatePollUseCase {
  constructor(
    private pollRepository: PollRepository,
    private voteRepository: VoteRepository
  ) {}

  async execute(input: UpdatePollInput): Promise<Result<void, string>> {
    // 1. Check if poll exists
    const pollResult = await this.pollRepository.getPollById(input.pollId);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // 2. Check if user is the poll creator
    if (poll.createdBy !== input.userId) {
      return failure(PollErrors.NOT_POLL_CREATOR);
    }

    // 3. Check if poll can be edited
    const hasVotesResult = await this.voteRepository.pollHasVotes(input.pollId);

    if (!hasVotesResult.success) {
      return failure(hasVotesResult.error);
    }

    const hasVotes = hasVotesResult.value;
    const canEditResult = poll.canEdit(hasVotes);

    if (!canEditResult.success) {
      return failure(canEditResult.error);
    }

    if (!canEditResult.value) {
      // Determine which restriction is violated
      if (poll.isActive()) {
        return failure(PollErrors.CANNOT_MODIFY_ACTIVE);
      }

      if (poll.isFinished()) {
        return failure(PollErrors.CANNOT_MODIFY_FINISHED);
      }

      if (hasVotes) {
        return failure(PollErrors.CANNOT_MODIFY_HAS_VOTES);
      }
    }

    // 4. Update poll properties
    const titleResult = poll.updateTitle(input.title);

    if (!titleResult.success) {
      return failure(titleResult.error);
    }

    const descriptionResult = poll.updateDescription(input.description);

    if (!descriptionResult.success) {
      return failure(descriptionResult.error);
    }

    const datesResult = poll.updateDates(input.startDate, input.endDate);

    if (!datesResult.success) {
      return failure(datesResult.error);
    }

    // 5. Persist the updated poll
    const saveResult = await this.pollRepository.updatePoll(poll);

    if (!saveResult.success) {
      return failure(saveResult.error);
    }

    return success(undefined);
  }
}
