/** UpdateQuestion decodes raw request identities before invoking core ports.
 * Authorization and persistence are coordinated here; entity invariants stay in the domain. */
import { z } from 'zod';
import {
  parseQuestionText,
  parseQuestionDetails,
} from '@/domain/poll/QuestionValues';
import { QuestionId, UserId } from '@/domain/shared/EntityIds';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { QuestionRepository } from '../../domain/poll/QuestionRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { PollErrors, PollUseCaseFailure } from './PollErrors';
import { QuestionType } from '../../domain/poll/QuestionType';

export interface UpdateQuestionInput {
  questionId: string;
  userId: string;
  text?: string;
  details?: string | null;
  questionType?: QuestionType;
}

const request = z.object({ questionId: QuestionId, userId: UserId });

export class UpdateQuestionUseCase {
  constructor(
    private pollRepository: PollRepository,
    private questionRepository: QuestionRepository,
    private voteRepository: VoteRepository,
    private userRepository: UserRepository,
    private profanityChecker?: ProfanityChecker
  ) {}

  async execute(
    rawInput: UpdateQuestionInput
  ): Promise<Result<void, PollUseCaseFailure>> {
    const decoded = request.safeParse(rawInput);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const input = { ...rawInput, ...decoded.data };

    // Get the question
    const questionResult = await this.questionRepository.getQuestionById(
      input.questionId
    );

    if (!questionResult.success) {
      return failure(questionResult.error);
    }

    const question = questionResult.value;

    if (!question) {
      return failure(PollErrors.QUESTION_NOT_FOUND);
    }

    // Get the poll
    const pollResult = await this.pollRepository.getPollById(question.pollId);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // Check authorization: creator or superadmin
    const isSuperAdmin = await this.userRepository.isSuperAdmin(input.userId);

    if (!isSuperAdmin && poll.createdBy !== input.userId) {
      return failure(PollErrors.NOT_POLL_CREATOR);
    }

    // Check if poll can be edited
    const hasVotesResult = await this.voteRepository.pollHasVotes(poll.id);

    if (!hasVotesResult.success) {
      return failure(hasVotesResult.error);
    }

    // Check poll state
    // A submitted poll is the author's handover to an admin; it must not
    // change underneath them until it is recalled to DRAFT.
    if (poll.isSubmitted()) {
      return failure(PollErrors.CANNOT_MODIFY_SUBMITTED);
    }

    if (poll.isActive()) {
      return failure(PollErrors.CANNOT_MODIFY_ACTIVE);
    }

    if (poll.isFinished()) {
      return failure(PollErrors.CANNOT_MODIFY_FINISHED);
    }

    if (hasVotesResult.value) {
      return failure(PollErrors.CANNOT_MODIFY_HAS_VOTES);
    }

    // Update question properties
    if (input.text !== undefined) {
      const text = parseQuestionText(input.text);

      if (!text.success) {
        return text;
      }

      const textResult = question.updateText(text.value, this.profanityChecker);

      if (!textResult.success) {
        return failure(textResult.error);
      }
    }

    if (input.details !== undefined) {
      const details = parseQuestionDetails(input.details);

      if (!details.success) {
        return details;
      }

      const detailsResult = question.updateDetails(
        details.value,
        this.profanityChecker
      );

      if (!detailsResult.success) {
        return failure(detailsResult.error);
      }
    }

    if (input.questionType !== undefined) {
      const typeResult = question.updateType(input.questionType);

      if (!typeResult.success) {
        return failure(typeResult.error);
      }
    }

    // Save updated question
    const updateResult = await this.questionRepository.updateQuestion(question);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    return success(undefined);
  }
}
