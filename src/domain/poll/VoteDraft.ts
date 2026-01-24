import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes } from './PollDomainCodes';

export interface VoteDraftProps {
  id: string;
  pollId: string;
  questionId: string;
  answerId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class VoteDraft {
  private constructor(private props: VoteDraftProps) {}

  public static create(
    pollId: string,
    questionId: string,
    answerId: string,
    userId: string
  ): Result<VoteDraft, string> {
    const now = new Date();
    const draft = new VoteDraft({
      id: '',
      pollId,
      questionId,
      answerId,
      userId,
      createdAt: now,
      updatedAt: now,
    });

    return success(draft);
  }

  public static reconstitute(props: VoteDraftProps): VoteDraft {
    return new VoteDraft(props);
  }

  // Getters
  public get id(): string {
    return this.props.id;
  }

  public get pollId(): string {
    return this.props.pollId;
  }

  public get questionId(): string {
    return this.props.questionId;
  }

  public get answerId(): string {
    return this.props.answerId;
  }

  public get userId(): string {
    return this.props.userId;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public touch(): void {
    this.props.updatedAt = new Date();
  }
}
