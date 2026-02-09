import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { QuestionRepository } from '../../domain/poll/QuestionRepository';
import { AnswerRepository } from '../../domain/poll/AnswerRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Answer } from '../../domain/poll/Answer';
import { PollErrors } from './PollErrors';

export interface CreateAnswerInput {
  questionId: string;
  userId: string;
  text: string;
  order: number;
}

export class CreateAnswerUseCase {
  constructor(
    private pollRepository: PollRepository,
    private questionRepository: QuestionRepository,
    private answerRepository: AnswerRepository,
    private voteRepository: VoteRepository,
    private userRepository: UserRepository
  ) {}

  async execute(input: CreateAnswerInput): Promise<Result<Answer, string>> {
    // Get the question to find its poll
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

    // Get the poll (with questions loaded)
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

    // Check if poll has votes
    const hasVotesResult = await this.voteRepository.pollHasVotes(poll.id);

    if (!hasVotesResult.success) {
      return failure(hasVotesResult.error);
    }

    if (hasVotesResult.value) {
      return failure(PollErrors.CANNOT_MODIFY_HAS_VOTES);
    }

    // Add answer through aggregate root (validates poll state)
    const addAnswerResult = poll.addAnswerToQuestion(
      input.questionId,
      input.text,
      input.order
    );

    if (!addAnswerResult.success) {
      return failure(addAnswerResult.error);
    }

    const answer = addAnswerResult.value;

    // Save the answer to database
    const createResult = await this.answerRepository.createAnswer(answer);

    if (!createResult.success) {
      return failure(createResult.error);
    }

    return success(createResult.value);
  }
}
