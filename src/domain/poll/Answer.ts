import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes } from './PollDomainCodes';

export interface AnswerProps {
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
    text: string,
    order: number,
    questionId: string
  ): Result<Answer, string> {
    if (!text || text.trim().length === 0) {
      return failure(PollDomainCodes.ANSWER_TEXT_EMPTY);
    }

    if (text.length > 1000) {
      return failure(PollDomainCodes.ANSWER_TEXT_TOO_LONG);
    }

    if (order < 0) {
      return failure(PollDomainCodes.ANSWER_INVALID_ORDER);
    }

    const answer = new Answer({
      id: '',
      text: text.trim(),
      order,
      questionId,
      createdAt: new Date(),
      archivedAt: null,
    });

    return success(answer);
  }

  public static reconstitute(props: AnswerProps): Answer {
    return new Answer(props);
  }

  // Getters
  public get id(): string {
    return this.props.id;
  }

  public get text(): string {
    return this.props.text;
  }

  public get order(): number {
    return this.props.order;
  }

  public get questionId(): string {
    return this.props.questionId;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get archivedAt(): Date | null {
    return this.props.archivedAt;
  }

  public isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  public updateText(newText: string): Result<void, string> {
    if (!newText || newText.trim().length === 0) {
      return failure(PollDomainCodes.ANSWER_TEXT_EMPTY);
    }

    if (newText.length > 1000) {
      return failure(PollDomainCodes.ANSWER_TEXT_TOO_LONG);
    }

    this.props.text = newText.trim();

    return success(undefined);
  }

  public updateOrder(newOrder: number): Result<void, string> {
    if (newOrder < 0) {
      return failure(PollDomainCodes.ANSWER_INVALID_ORDER);
    }

    this.props.order = newOrder;

    return success(undefined);
  }

  public archive(): Result<void, string> {
    if (this.isArchived()) {
      return failure(PollDomainCodes.ANSWER_ALREADY_ARCHIVED);
    }

    this.props.archivedAt = new Date();

    return success(undefined);
  }

  public toJSON(): AnswerProps {
    return { ...this.props };
  }
}
