import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import {
  QuestionRepository,
  UpdateQuestionOrderData,
} from '../../domain/poll/QuestionRepository';
import { PollErrors } from './PollErrors';

export interface UpdateQuestionOrderInput {
  pollId: string;
  updates: UpdateQuestionOrderData[];
}

export class UpdateQuestionOrderUseCase {
  constructor(
    private pollRepository: PollRepository,
    private questionRepository: QuestionRepository
  ) {}

  async execute(
    input: UpdateQuestionOrderInput
  ): Promise<Result<void, string>> {
    // 1. Check if poll exists
    const pollResult = await this.pollRepository.getPollById(input.pollId);

    if (!pollResult.success || !pollResult.value) {
      return failure(PollErrors.NOT_FOUND);
    }

    const poll = pollResult.value;

    // 2. Check if poll is finished
    if (poll.isFinished()) {
      return failure(PollErrors.CANNOT_MODIFY_FINISHED);
    }

    // 3. Validate updates
    if (!input.updates || input.updates.length === 0) {
      return failure(PollErrors.NO_UPDATES);
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
