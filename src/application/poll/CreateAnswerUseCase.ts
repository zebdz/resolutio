/** CreateAnswer decodes raw request identities and position units before invoking core ports.
 * Authorization and persistence are coordinated here; entity invariants stay in the domain. */
import { SortOrder, parseAnswerText } from '@/domain/poll/QuestionValues';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import { Clock, IdGenerator, entityCreation } from '../shared/EntityCreation';
import { z } from 'zod';
import { QuestionId, UserId, AnswerId } from '@/domain/shared/EntityIds';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { QuestionRepository } from '../../domain/poll/QuestionRepository';
import { AnswerRepository } from '../../domain/poll/AnswerRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Answer } from '../../domain/poll/Answer';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { PollErrors, PollUseCaseFailure } from './PollErrors';

export interface CreateAnswerInput {
  questionId: string;
  userId: string;
  text: string;
  order: number;
}

const request = z.object({ questionId: QuestionId, userId: UserId });

export class CreateAnswerUseCase {
  constructor(
    private pollRepository: PollRepository,
    private questionRepository: QuestionRepository,
    private answerRepository: AnswerRepository,
    private voteRepository: VoteRepository,
    private userRepository: UserRepository,
    private ids: IdGenerator,
    private clock: Clock,
    private profanityChecker?: ProfanityChecker
  ) {}

  async execute(
    rawInput: CreateAnswerInput
  ): Promise<Result<Answer, PollUseCaseFailure>> {
    const decoded = request.safeParse(rawInput);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const input = { ...rawInput, ...decoded.data };

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

    const order = SortOrder.safeParse(input.order);

    if (!order.success) {
      return failure(PollDomainCodes.ANSWER_INVALID_ORDER);
    }

    // Add answer through aggregate root (validates poll state)
    const target = poll.questionForNewAnswer(input.questionId);

    if (!target.success) {
      return target;
    }

    const text = parseAnswerText(input.text);

    if (!text.success) {
      return text;
    }

    const addAnswerResult = poll.addAnswerToQuestion(
      input.questionId,
      text.value,
      order.data,
      entityCreation(AnswerId, this.ids, this.clock),
      this.profanityChecker
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
