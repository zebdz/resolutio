/** AddQuestion decodes raw request identities and position units before invoking core ports.
 * Authorization and persistence are coordinated here; entity invariants stay in the domain. */
import {
  PageNumber,
  SortOrder,
  parseQuestionText,
  parseQuestionDetails,
  parseAnswerText,
} from '@/domain/poll/QuestionValues';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import { Clock, IdGenerator, entityCreation } from '../shared/EntityCreation';
import { z } from 'zod';
import {
  PollId,
  UserId,
  QuestionId,
  AnswerId,
} from '@/domain/shared/EntityIds';
import { Result, success, failure } from '../../domain/shared/Result';
import { Question } from '../../domain/poll/Question';
import { Answer } from '../../domain/poll/Answer';
import { PollRepository } from '../../domain/poll/PollRepository';
import { QuestionRepository } from '../../domain/poll/QuestionRepository';
import { AnswerRepository } from '../../domain/poll/AnswerRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { QuestionType } from '../../domain/poll/QuestionType';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { PollErrors, PollUseCaseFailure } from './PollErrors';

export interface AddQuestionInput {
  pollId: string;
  userId: string;
  text: string;
  details?: string;
  page: number;
  order: number;
  questionType: QuestionType;
  answers: string[];
}

const request = z.object({ pollId: PollId, userId: UserId });

export class AddQuestionUseCase {
  constructor(
    private pollRepository: PollRepository,
    private questionRepository: QuestionRepository,
    private answerRepository: AnswerRepository,
    private userRepository: UserRepository,
    private ids: IdGenerator,
    private clock: Clock,
    private profanityChecker?: ProfanityChecker
  ) {}

  async execute(
    rawInput: AddQuestionInput
  ): Promise<Result<Question, PollUseCaseFailure>> {
    const decoded = request.safeParse(rawInput);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const input = { ...rawInput, ...decoded.data };

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

    // 3. Validate answers
    if (!input.answers || input.answers.length === 0) {
      return failure(PollErrors.NO_ANSWERS);
    }

    const page = PageNumber.safeParse(input.page);

    if (!page.success) {
      return failure(PollDomainCodes.QUESTION_INVALID_PAGE);
    }

    const order = SortOrder.safeParse(input.order);

    if (!order.success) {
      return failure(PollDomainCodes.QUESTION_INVALID_ORDER);
    }

    // 4. Decode content before creating the validated question domain object.
    const text = parseQuestionText(input.text);

    if (!text.success) {
      return text;
    }

    const details = parseQuestionDetails(input.details);

    if (!details.success) {
      return details;
    }

    const questionResult = Question.create(
      text.value,
      input.pollId,
      entityCreation(QuestionId, this.ids, this.clock),
      page.data,
      order.data,
      input.questionType,
      details.value,
      this.profanityChecker
    );

    if (!questionResult.success) {
      return failure(questionResult.error);
    }

    // 5. Persist the validated question
    const createdQuestionResult = await this.questionRepository.createQuestion(
      questionResult.value
    );

    if (!createdQuestionResult.success) {
      return failure(PollErrors.QUESTION_NOT_FOUND); // Repository persistence error
    }

    const question = createdQuestionResult.value;

    // 6. Create and persist answers
    for (let i = 0; i < input.answers.length; i++) {
      const answerText = parseAnswerText(input.answers[i]);

      if (!answerText.success) {
        return answerText;
      }

      const answerResult = Answer.create(
        answerText.value,
        SortOrder.parse(i),
        question.id,
        entityCreation(AnswerId, this.ids, this.clock),
        this.profanityChecker
      );

      if (!answerResult.success) {
        return failure(answerResult.error);
      }

      const createdAnswerResult = await this.answerRepository.createAnswer(
        answerResult.value
      );

      if (!createdAnswerResult.success) {
        return failure(PollErrors.ANSWER_NOT_FOUND); // Repository persistence error
      }
    }

    // 7. Get the question with all its answers
    const questionWithAnswersResult =
      await this.questionRepository.getQuestionById(question.id);

    if (
      !questionWithAnswersResult.success ||
      !questionWithAnswersResult.value
    ) {
      return failure(PollErrors.QUESTION_NOT_FOUND);
    }

    return success(questionWithAnswersResult.value);
  }
}
