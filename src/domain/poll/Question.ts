import { Result, success, failure } from '../shared/Result';
import { QuestionType, isValidQuestionType } from './QuestionType';
import { Answer, AnswerProps } from './Answer';
import { PollDomainCodes } from './PollDomainCodes';

export interface QuestionProps {
  id: string;
  text: string;
  details: string | null;
  pollId: string;
  page: number;
  order: number;
  questionType: QuestionType;
  createdAt: Date;
  archivedAt: Date | null;
  answers: Answer[];
}

export class Question {
  private constructor(private props: QuestionProps) {}

  public static create(
    text: string,
    pollId: string,
    page: number = 1,
    order: number = 0,
    questionType: QuestionType = 'single-choice',
    details?: string
  ): Result<Question, string> {
    if (!text || text.trim().length === 0) {
      return failure(PollDomainCodes.QUESTION_TEXT_EMPTY);
    }

    if (text.length > 1000) {
      return failure(PollDomainCodes.QUESTION_TEXT_TOO_LONG);
    }

    if (details && details.length > 5000) {
      return failure(PollDomainCodes.QUESTION_DETAILS_TOO_LONG);
    }

    if (page < 1) {
      return failure(PollDomainCodes.QUESTION_INVALID_PAGE);
    }

    if (order < 0) {
      return failure(PollDomainCodes.QUESTION_INVALID_ORDER);
    }

    if (!isValidQuestionType(questionType)) {
      return failure(PollDomainCodes.QUESTION_INVALID_TYPE);
    }

    const question = new Question({
      id: '',
      text: text.trim(),
      details: details?.trim() || null,
      pollId,
      page,
      order,
      questionType,
      createdAt: new Date(),
      archivedAt: null,
      answers: [],
    });

    return success(question);
  }

  public static reconstitute(props: QuestionProps): Question {
    return new Question(props);
  }

  // Getters
  public get id(): string {
    return this.props.id;
  }

  public get text(): string {
    return this.props.text;
  }

  public get details(): string | null {
    return this.props.details;
  }

  public get pollId(): string {
    return this.props.pollId;
  }

  public get page(): number {
    return this.props.page;
  }

  public get order(): number {
    return this.props.order;
  }

  public get questionType(): QuestionType {
    return this.props.questionType;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get archivedAt(): Date | null {
    return this.props.archivedAt;
  }

  public get answers(): Answer[] {
    return [...this.props.answers];
  }

  public isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  public updateText(newText: string): Result<void, string> {
    if (!newText || newText.trim().length === 0) {
      return failure(PollDomainCodes.QUESTION_TEXT_EMPTY);
    }

    if (newText.length > 1000) {
      return failure(PollDomainCodes.QUESTION_TEXT_TOO_LONG);
    }

    this.props.text = newText.trim();

    return success(undefined);
  }

  public updateDetails(newDetails: string | null): Result<void, string> {
    if (newDetails && newDetails.length > 5000) {
      return failure(PollDomainCodes.QUESTION_DETAILS_TOO_LONG);
    }

    this.props.details = newDetails?.trim() || null;

    return success(undefined);
  }

  public updatePage(newPage: number): Result<void, string> {
    if (newPage < 1) {
      return failure(PollDomainCodes.QUESTION_INVALID_PAGE);
    }

    this.props.page = newPage;

    return success(undefined);
  }

  public updateOrder(newOrder: number): Result<void, string> {
    if (newOrder < 0) {
      return failure(PollDomainCodes.QUESTION_INVALID_ORDER);
    }

    this.props.order = newOrder;

    return success(undefined);
  }

  public updateType(newType: QuestionType): Result<void, string> {
    if (!isValidQuestionType(newType)) {
      return failure(PollDomainCodes.QUESTION_INVALID_TYPE);
    }

    this.props.questionType = newType;

    return success(undefined);
  }

  public addAnswer(answer: Answer): Result<void, string> {
    if (this.isArchived()) {
      return failure(PollDomainCodes.QUESTION_CANNOT_ADD_ANSWER_ARCHIVED);
    }

    this.props.answers.push(answer);

    return success(undefined);
  }

  public removeAnswer(answerId: string): Result<void, string> {
    if (this.isArchived()) {
      return failure(PollDomainCodes.QUESTION_CANNOT_REMOVE_ANSWER_ARCHIVED);
    }

    const index = this.props.answers.findIndex((a) => a.id === answerId);

    if (index === -1) {
      return failure(PollDomainCodes.QUESTION_ANSWER_NOT_FOUND);
    }

    // Archive the answer instead of removing it
    const archiveResult = this.props.answers[index].archive();

    if (!archiveResult.success) {
      return failure(archiveResult.error);
    }

    return success(undefined);
  }

  public archive(): Result<void, string> {
    if (this.isArchived()) {
      return failure(PollDomainCodes.QUESTION_ALREADY_ARCHIVED);
    }

    this.props.archivedAt = new Date();

    return success(undefined);
  }

  public toJSON(): Omit<QuestionProps, 'answers'> & { answers: AnswerProps[] } {
    return {
      ...this.props,
      answers: this.props.answers.map((a) => a.toJSON()),
    };
  }
}
