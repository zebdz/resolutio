import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { PollErrors } from './PollErrors';

export interface DeleteQuestionInput {
  questionId: string;
  userId: string;
}

export class DeleteQuestionUseCase {
  constructor(private pollRepository: PollRepository) {}

  async execute(input: DeleteQuestionInput): Promise<Result<void, string>> {
    // Get the question
    const questionResult = await this.pollRepository.getQuestionById(
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

    // Check authorization: user must be poll creator
    if (poll.createdBy !== input.userId) {
      return failure(PollErrors.NOT_POLL_CREATOR);
    }

    // Check if poll can be edited
    const hasVotesResult = await this.pollRepository.pollHasVotes(poll.id);
    if (!hasVotesResult.success) {
      return failure(hasVotesResult.error);
    }

    // Check poll state
    if (poll.isActive()) {
      return failure(PollErrors.CANNOT_MODIFY_ACTIVE);
    }

    if (poll.isFinished()) {
      return failure(PollErrors.CANNOT_MODIFY_FINISHED);
    }

    if (hasVotesResult.value) {
      return failure(PollErrors.CANNOT_MODIFY_HAS_VOTES);
    }

    // Delete (archive) the question
    const deleteResult = await this.pollRepository.deleteQuestion(
      input.questionId
    );

    if (!deleteResult.success) {
      return failure(deleteResult.error);
    }

    return success(undefined);
  }
}
