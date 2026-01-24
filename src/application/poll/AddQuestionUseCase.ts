import { Result, success, failure } from '../../domain/shared/Result';
import { Question } from '../../domain/poll/Question';
import { Answer } from '../../domain/poll/Answer';
import { PollRepository } from '../../domain/poll/PollRepository';
import { QuestionRepository } from '../../domain/poll/QuestionRepository';
import { AnswerRepository } from '../../domain/poll/AnswerRepository';
import { QuestionType } from '../../domain/poll/QuestionType';
import { PollErrors } from './PollErrors';

export interface AddQuestionInput {
  pollId: string;
  text: string;
  details?: string;
  page: number;
  order: number;
  questionType: QuestionType;
  answers: string[];
}

export class AddQuestionUseCase {
  constructor(
    private pollRepository: PollRepository,
    private questionRepository: QuestionRepository,
    private answerRepository: AnswerRepository
  ) {}

  async execute(input: AddQuestionInput): Promise<Result<Question, string>> {
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

    // 3. Validate answers
    if (!input.answers || input.answers.length === 0) {
      return failure(PollErrors.NO_ANSWERS);
    }

    // 4. Create question domain object with validation
    const questionResult = Question.create(
      input.text,
      input.pollId,
      input.page,
      input.order,
      input.questionType,
      input.details
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
      const answerResult = Answer.create(input.answers[i], i, question.id);

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
