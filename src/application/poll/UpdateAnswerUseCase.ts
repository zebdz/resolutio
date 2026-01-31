import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { QuestionRepository } from '../../domain/poll/QuestionRepository';
import { AnswerRepository } from '../../domain/poll/AnswerRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { PollErrors } from './PollErrors';

export interface UpdateAnswerInput {
  answerId: string;
  userId: string;
  text?: string;
  order?: number;
}

export class UpdateAnswerUseCase {
  constructor(
    private pollRepository: PollRepository,
    private questionRepository: QuestionRepository,
    private answerRepository: AnswerRepository,
    private voteRepository: VoteRepository
  ) {}

  async execute(input: UpdateAnswerInput): Promise<Result<void, string>> {
    // Get the answer
    const answerResult = await this.answerRepository.getAnswerById(
      input.answerId
    );

    if (!answerResult.success) {
      return failure(answerResult.error);
    }

    const answer = answerResult.value;

    if (!answer) {
      return failure(PollErrors.ANSWER_NOT_FOUND);
    }

    // Get the question
    const questionResult = await this.questionRepository.getQuestionById(
      answer.questionId
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
    const hasVotesResult = await this.voteRepository.pollHasVotes(poll.id);

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

    // Update answer properties
    if (input.text !== undefined) {
      const textResult = answer.updateText(input.text);

      if (!textResult.success) {
        return failure(textResult.error);
      }
    }

    if (input.order !== undefined) {
      const orderResult = answer.updateOrder(input.order);

      if (!orderResult.success) {
        return failure(orderResult.error);
      }
    }

    // Save updated answer
    const updateResult = await this.answerRepository.updateAnswer(answer);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    return success(undefined);
  }
}
