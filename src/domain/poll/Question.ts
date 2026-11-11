/** Question owns identity, typed page/order positions and answer membership within a poll.
 * Creation/archive are deterministic; raw storage values enter through validation. */
import { PollId, QuestionId, AnswerId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import {
  PageNumber,
  SortOrder,
  QuestionText,
  QuestionDetails,
  parseQuestionText,
  parseQuestionDetails,
} from './QuestionValues';
import { Result, success, failure } from '../shared/Result';
import { QuestionType, isValidQuestionType } from './QuestionType';
import { Answer, AnswerData } from './Answer';
import { PollDomainCodes, PollDomainCode } from './PollDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';

export {
  QUESTION_TEXT_MAX_LENGTH,
  QUESTION_DETAILS_MAX_LENGTH,
} from './QuestionValues';
export type QuestionFailure =
  | PollDomainCode
  | typeof SharedDomainCodes.CONTAINS_PROFANITY;

export interface QuestionProps {
  readonly id: QuestionId;
  text: QuestionText;
  details: QuestionDetails | null;
  readonly pollId: PollId;
  page: PageNumber;
  order: SortOrder;
  questionType: QuestionType;
  readonly createdAt: Instant;
  archivedAt: Instant | null;
  answers: Answer[];
}

/** Raw question fields enter alongside answers already decoded by the adapter. */
export interface QuestionReconstitutionData {
  id: string;
  text: string;
  details: string | null;
  pollId: string;
  page: number;
  order: number;
  questionType: string;
  createdAt: Date;
  archivedAt: Date | null;
  answers: Answer[];
}

/** Plain nested serialization shape; no domain entities cross the client boundary. */
export type QuestionData = Omit<
  QuestionReconstitutionData,
  'answers' | 'questionType'
> & {
  questionType: QuestionType;
  answers: AnswerData[];
};

export class Question {
  private constructor(private props: QuestionProps) {}

  public static create(
    text: QuestionText,
    pollId: PollId,
    creation: EntityCreation<QuestionId>,
    page: PageNumber = PageNumber.parse(1),
    order: SortOrder = SortOrder.parse(0),
    questionType: QuestionType = 'single-choice',
    details: QuestionDetails | null = null,
    profanityChecker?: ProfanityChecker
  ): Result<Question, QuestionFailure> {
    const content = parseQuestionText(text);

    if (!content.success) {
      return content;
    }

    const description = parseQuestionDetails(details);

    if (!description.success) {
      return description;
    }

    const parsedPage = PageNumber.safeParse(page);

    if (!parsedPage.success) {
      return failure(PollDomainCodes.QUESTION_INVALID_PAGE);
    }

    const parsedOrder = SortOrder.safeParse(order);

    if (!parsedOrder.success) {
      return failure(PollDomainCodes.QUESTION_INVALID_ORDER);
    }

    if (!isValidQuestionType(questionType)) {
      return failure(PollDomainCodes.QUESTION_INVALID_TYPE);
    }

    if (profanityChecker?.containsProfanity(content.value)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    if (
      description.value &&
      profanityChecker?.containsProfanity(description.value)
    ) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    const id = QuestionId.safeParse(creation?.id);
    const parent = PollId.safeParse(pollId);
    const now = Instant.safeParse(creation?.now);

    if (!id.success || !parent.success || !now.success) {
      return failure(PollDomainCodes.QUESTION_INVALID_DATA);
    }

    const question = new Question({
      id: id.data,
      text: content.value,
      details: description.value,
      pollId: parent.data,
      page: parsedPage.data,
      order: parsedOrder.data,
      questionType,
      createdAt: now.data,
      archivedAt: null,
      answers: [],
    });

    return success(question);
  }

  public static reconstitute(props: QuestionReconstitutionData): Question {
    try {
      const id = QuestionId.parse(props.id);

      if (
        !isValidQuestionType(props.questionType) ||
        props.answers.some(
          (answer) => !(answer instanceof Answer) || answer.questionId !== id
        ) ||
        new Set(props.answers.map((answer) => answer.id)).size !==
          props.answers.length
      ) {
        throw new Error(PollDomainCodes.QUESTION_INVALID_DATA);
      }

      return new Question({
        id,
        text: QuestionText.parse(props.text),
        details:
          props.details === null ? null : QuestionDetails.parse(props.details),
        pollId: PollId.parse(props.pollId),
        page: PageNumber.parse(props.page),
        order: SortOrder.parse(props.order),
        questionType: props.questionType,
        createdAt: Instant.fromDate(props.createdAt),
        archivedAt:
          props.archivedAt === null ? null : Instant.fromDate(props.archivedAt),
        answers: [...props.answers],
      });
    } catch {
      throw new Error(PollDomainCodes.QUESTION_INVALID_DATA);
    }
  }

  // Getters
  public get id(): QuestionId {
    return this.props.id;
  }

  public get text(): QuestionText {
    return this.props.text;
  }

  public get details(): QuestionDetails | null {
    return this.props.details;
  }

  public get pollId(): PollId {
    return this.props.pollId;
  }

  public get page(): PageNumber {
    return this.props.page;
  }

  public get order(): SortOrder {
    return this.props.order;
  }

  public get questionType(): QuestionType {
    return this.props.questionType;
  }

  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }

  public get archivedAt(): Date | null {
    return this.props.archivedAt === null
      ? null
      : Instant.toDate(this.props.archivedAt);
  }

  public get answers(): Answer[] {
    return [...this.props.answers];
  }

  public isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  public updateText(
    newText: QuestionText,
    profanityChecker?: ProfanityChecker
  ): Result<void, QuestionFailure> {
    const content = parseQuestionText(newText);

    if (!content.success) {
      return content;
    }

    if (profanityChecker?.containsProfanity(content.value)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.text = content.value;

    return success(undefined);
  }

  public updateDetails(
    newDetails: QuestionDetails | null,
    profanityChecker?: ProfanityChecker
  ): Result<void, QuestionFailure> {
    const description = parseQuestionDetails(newDetails);

    if (!description.success) {
      return description;
    }

    if (
      description.value &&
      profanityChecker?.containsProfanity(description.value)
    ) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.details = description.value;

    return success(undefined);
  }

  public updatePage(newPage: PageNumber): Result<void, QuestionFailure> {
    const parsed = PageNumber.safeParse(newPage);

    if (!parsed.success) {
      return failure(PollDomainCodes.QUESTION_INVALID_PAGE);
    }

    this.props.page = parsed.data;

    return success(undefined);
  }

  public updateOrder(newOrder: SortOrder): Result<void, QuestionFailure> {
    const parsed = SortOrder.safeParse(newOrder);

    if (!parsed.success) {
      return failure(PollDomainCodes.QUESTION_INVALID_ORDER);
    }

    this.props.order = parsed.data;

    return success(undefined);
  }

  public updateType(newType: QuestionType): Result<void, QuestionFailure> {
    if (!isValidQuestionType(newType)) {
      return failure(PollDomainCodes.QUESTION_INVALID_TYPE);
    }

    this.props.questionType = newType;

    return success(undefined);
  }

  public addAnswer(answer: Answer): Result<void, QuestionFailure> {
    if (this.isArchived()) {
      return failure(PollDomainCodes.QUESTION_CANNOT_ADD_ANSWER_ARCHIVED);
    }

    if (
      answer.questionId !== this.id ||
      this.props.answers.some((existing) => existing.id === answer.id)
    ) {
      return failure(PollDomainCodes.QUESTION_INVALID_DATA);
    }

    this.props.answers.push(answer);

    return success(undefined);
  }

  public removeAnswer(
    answerId: AnswerId,
    at: Instant
  ): Result<void, QuestionFailure> {
    if (this.isArchived()) {
      return failure(PollDomainCodes.QUESTION_CANNOT_REMOVE_ANSWER_ARCHIVED);
    }

    const index = this.props.answers.findIndex((a) => a.id === answerId);

    if (index === -1) {
      return failure(PollDomainCodes.QUESTION_ANSWER_NOT_FOUND);
    }

    // Archive the answer instead of removing it
    const archiveResult = this.props.answers[index].archive(at);

    if (!archiveResult.success) {
      return failure(archiveResult.error);
    }

    return success(undefined);
  }

  public archive(at: Instant): Result<void, QuestionFailure> {
    if (this.isArchived()) {
      return failure(PollDomainCodes.QUESTION_ALREADY_ARCHIVED);
    }

    const parsed = Instant.safeParse(at);

    if (!parsed.success) {
      return failure(PollDomainCodes.QUESTION_INVALID_DATA);
    }

    this.props.archivedAt = parsed.data;

    return success(undefined);
  }

  /** Nested snapshots keep their validated identities, content and position units. */
  public toJSON() {
    return {
      ...this.props,
      createdAt: this.createdAt,
      archivedAt: this.archivedAt,
      answers: this.props.answers.map((a) => a.toJSON()),
    } satisfies QuestionData;
  }
}
