import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes } from './PollDomainCodes';

export interface VoteProps {
  id: string;
  questionId: string;
  answerId: string;
  userId: string;
  userWeight: number;
  createdAt: Date;
}

export class Vote {
  private constructor(private props: VoteProps) {}

  public static create(
    questionId: string,
    answerId: string,
    userId: string,
    userWeight: number
  ): Result<Vote, string> {
    if (userWeight < 0) {
      return failure(PollDomainCodes.INVALID_WEIGHT);
    }

    const vote = new Vote({
      id: '',
      questionId,
      answerId,
      userId,
      userWeight,
      createdAt: new Date(),
    });

    return success(vote);
  }

  public static reconstitute(props: VoteProps): Vote {
    return new Vote(props);
  }

  // Getters
  public get id(): string {
    return this.props.id;
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

  public get userWeight(): number {
    return this.props.userWeight;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }
}
