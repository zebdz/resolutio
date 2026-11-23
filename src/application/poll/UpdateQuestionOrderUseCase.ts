/** Decodes raw reorder requests before authorization and typed persistence.
 * Position constraints are owned by the domain value schemas. */
import { z } from 'zod';
import { PollId, QuestionId, UserId } from '@/domain/shared/EntityIds';
import { PageNumber, SortOrder } from '@/domain/poll/QuestionValues';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { QuestionRepository } from '../../domain/poll/QuestionRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollErrors, PollUseCaseFailure } from './PollErrors';

export interface UpdateQuestionOrderInput {
  pollId: string;
  userId: string;
  updates: { questionId: string; page: number; order: number }[];
}

const request = z.object({
  pollId: PollId,
  userId: UserId,
  updates: z.array(
    z.object({ questionId: QuestionId, page: PageNumber, order: SortOrder })
  ),
});

export class UpdateQuestionOrderUseCase {
  constructor(
    private pollRepository: PollRepository,
    private questionRepository: QuestionRepository,
    private userRepository: UserRepository
  ) {}

  async execute(
    rawInput: UpdateQuestionOrderInput
  ): Promise<Result<void, PollUseCaseFailure>> {
    const decoded = request.safeParse(rawInput);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const input = decoded.data;
    // 1. Check if poll exists
    const pollResult = await this.pollRepository.getPollById(input.pollId);

    if (!pollResult.success || !pollResult.value) {
      return failure(PollErrors.NOT_FOUND);
    }

    const poll = pollResult.value;

    // 2. Check authorization: creator or superadmin
    const isSuperAdmin = await this.userRepository.isSuperAdmin(input.userId);

    if (!isSuperAdmin && poll.createdBy !== input.userId) {
      return failure(PollErrors.NOT_POLL_CREATOR);
    }

    // 3. Check if poll is finished
    // A submitted poll is the author's handover to an admin; it must not
    // change underneath them until it is recalled to DRAFT.
    if (poll.isSubmitted()) {
      return failure(PollErrors.CANNOT_MODIFY_SUBMITTED);
    }

    if (poll.isFinished()) {
      return failure(PollErrors.CANNOT_MODIFY_FINISHED);
    }

    // 4. Validate updates
    if (!input.updates || input.updates.length === 0) {
      return failure(PollErrors.NO_UPDATES);
    }

    // Authorization for one poll does not grant access to another poll's questions.
    const editableQuestionIds = new Set(
      poll.questions
        .filter((question) => !question.isArchived())
        .map((question) => question.id)
    );

    if (
      input.updates.some(
        (update) => !editableQuestionIds.has(update.questionId)
      )
    ) {
      return failure(PollErrors.QUESTION_NOT_FOUND);
    }

    // 4. Update question orders
    const result = await this.questionRepository.updateQuestionOrder(
      input.updates
    );

    if (!result.success) {
      return failure(PollErrors.QUESTION_NOT_FOUND); // Repository operation error
    }

    return result;
  }
}
