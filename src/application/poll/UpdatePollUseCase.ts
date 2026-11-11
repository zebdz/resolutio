/** Poll application boundary validates requests, invokes domain behavior and
 * preserves known failure codes across authorization and persistence ports. */
import { z } from 'zod';
import {
  parsePollTitle,
  parsePollDescription,
} from '../../domain/poll/PollContent';
import { PollId, UserId } from '../../domain/shared/EntityIds';
import { PollPeriod } from '../../domain/poll/PollPeriod';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { PollErrors, PollUseCaseFailure } from './PollErrors';

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
    private voteRepository: VoteRepository,
    private userRepository: UserRepository,
    private profanityChecker?: ProfanityChecker
  ) {}

  async execute(
    rawRequest: UpdatePollInput
  ): Promise<Result<void, PollUseCaseFailure>> {
    const decoded = z
      .object({ pollId: PollId, userId: UserId })
      .safeParse(rawRequest);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const input = { ...rawRequest, ...decoded.data };

    // 1. Check if poll exists
    const pollResult = await this.pollRepository.getPollById(input.pollId);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // 2. Check authorization: creator or superadmin
    const isSuperAdmin = await this.userRepository.isSuperAdmin(input.userId);

    if (!isSuperAdmin && poll.createdBy !== input.userId) {
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
    const editable = poll.canEditContent();

    if (!editable.success) {
      return editable;
    }

    const title = parsePollTitle(input.title);

    if (!title.success) {
      return title;
    }

    const titleResult = poll.updateTitle(title.value, this.profanityChecker);

    if (!titleResult.success) {
      return failure(titleResult.error);
    }

    const description = parsePollDescription(input.description);

    if (!description.success) {
      return description;
    }

    const descriptionResult = poll.updateDescription(
      description.value,
      this.profanityChecker
    );

    if (!descriptionResult.success) {
      return failure(descriptionResult.error);
    }

    const period = PollPeriod.create(input.startDate, input.endDate);

    if (!period.success) {
      return period;
    }

    const datesResult = poll.updateDates(period.value);

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
