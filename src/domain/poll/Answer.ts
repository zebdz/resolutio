/** Answer owns a stable identity, a typed sort order and validated choice data.
 * Callers supply creation/archive time; persistence values are decoded on entry. */
import { AnswerId, QuestionId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes, PollDomainCode } from './PollDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';
import { SortOrder, AnswerText, parseAnswerText } from './QuestionValues';

export { ANSWER_TEXT_MAX_LENGTH } from './QuestionValues';
export type AnswerFailure =
  | PollDomainCode
  | typeof SharedDomainCodes.CONTAINS_PROFANITY;

export interface AnswerProps {
  readonly id: AnswerId;
  text: AnswerText;
  order: SortOrder;
  readonly questionId: QuestionId;
  readonly createdAt: Instant;
  archivedAt: Instant | null;
}

/** Explicit raw persistence/serialization shape. */
export interface AnswerData {
  id: string;
  text: string;
  order: number;
  questionId: string;
  createdAt: Date;
  archivedAt: Date | null;
}

export class Answer {
  private constructor(private props: AnswerProps) {}

  public static create(
    text: AnswerText,
    order: SortOrder,
    questionId: QuestionId,
    creation: EntityCreation<AnswerId>,
    profanityChecker?: ProfanityChecker
  ): Result<Answer, AnswerFailure> {
    const content = parseAnswerText(text);

    if (!content.success) {
      return content;
    }

    const parsedOrder = SortOrder.safeParse(order);

    if (!parsedOrder.success) {
      return failure(PollDomainCodes.ANSWER_INVALID_ORDER);
    }

    if (profanityChecker?.containsProfanity(content.value)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    const id = AnswerId.safeParse(creation?.id);
    const parent = QuestionId.safeParse(questionId);
    const now = Instant.safeParse(creation?.now);

    if (!id.success || !parent.success || !now.success) {
      return failure(PollDomainCodes.ANSWER_INVALID_DATA);
    }

    const answer = new Answer({
      id: id.data,
      text: content.value,
      order: parsedOrder.data,
      questionId: parent.data,
      createdAt: now.data,
      archivedAt: null,
    });

    return success(answer);
  }

  public static reconstitute(props: AnswerData): Answer {
    try {
      return new Answer({
        id: AnswerId.parse(props.id),
        text: AnswerText.parse(props.text),
        order: SortOrder.parse(props.order),
        questionId: QuestionId.parse(props.questionId),
        createdAt: Instant.fromDate(props.createdAt),
        archivedAt:
          props.archivedAt === null ? null : Instant.fromDate(props.archivedAt),
      });
    } catch {
      throw new Error(PollDomainCodes.ANSWER_INVALID_DATA);
    }
  }

  // Getters
  public get id(): AnswerId {
    return this.props.id;
  }

  public get text(): AnswerText {
    return this.props.text;
  }

  public get order(): SortOrder {
    return this.props.order;
  }

  public get questionId(): QuestionId {
    return this.props.questionId;
  }

  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }

  public get archivedAt(): Date | null {
    return this.props.archivedAt === null
      ? null
      : Instant.toDate(this.props.archivedAt);
  }

  public isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  public updateText(
    newText: AnswerText,
    profanityChecker?: ProfanityChecker
  ): Result<void, AnswerFailure> {
    const content = parseAnswerText(newText);

    if (!content.success) {
      return content;
    }

    if (profanityChecker?.containsProfanity(content.value)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.text = content.value;

    return success(undefined);
  }

  public updateOrder(newOrder: SortOrder): Result<void, AnswerFailure> {
    const parsed = SortOrder.safeParse(newOrder);

    if (!parsed.success) {
      return failure(PollDomainCodes.ANSWER_INVALID_ORDER);
    }

    this.props.order = parsed.data;

    return success(undefined);
  }

  public archive(at: Instant): Result<void, AnswerFailure> {
    if (this.isArchived()) {
      return failure(PollDomainCodes.ANSWER_ALREADY_ARCHIVED);
    }

    const parsed = Instant.safeParse(at);

    if (!parsed.success) {
      return failure(PollDomainCodes.ANSWER_INVALID_DATA);
    }

    this.props.archivedAt = parsed.data;

    return success(undefined);
  }

  /** Detached serialization preserves validated values without exposing the entity. */
  public toJSON() {
    return {
      ...this.props,
      createdAt: this.createdAt,
      archivedAt: this.archivedAt,
    } satisfies AnswerData;
  }
}
