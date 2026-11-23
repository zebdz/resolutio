/** Immutable accepted selection with a typed voting weight. The application supplies cast time, and adapters
 * persist that exact millisecond value and assigned identity so receipt/seal leaves agree. */
import { VoteId, QuestionId, AnswerId, UserId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { VotingWeight } from './VotingWeight';
import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes, PollDomainCode } from './PollDomainCodes';

export interface VoteProps {
  readonly id: VoteId;
  readonly questionId: QuestionId;
  readonly answerId: AnswerId;
  readonly userId: UserId;
  readonly userWeight: VotingWeight;
  readonly createdAt: Instant;
}

/** Raw persisted selection; validated before becoming an immutable domain entity. */
export interface VoteData {
  id: string;
  questionId: string;
  answerId: string;
  userId: string;
  userWeight: number;
  createdAt: Date;
}

export class Vote {
  private readonly props: Readonly<VoteProps>;

  private constructor(props: VoteProps) {
    this.props = Object.freeze({ ...props });
  }

  public static create(
    questionId: QuestionId,
    answerId: AnswerId,
    userId: UserId,
    userWeight: VotingWeight,
    creation: EntityCreation<VoteId>
  ): Result<Vote, PollDomainCode> {
    const weight = VotingWeight.safeParse(userWeight);

    if (!weight.success) {
      return failure(PollDomainCodes.INVALID_WEIGHT);
    }

    const now = Instant.safeParse(creation?.now);

    if (!now.success) {
      return failure(PollDomainCodes.POLL_INVALID_DATES);
    }

    const vote = new Vote({
      id: VoteId.parse(creation.id),
      questionId: QuestionId.parse(questionId),
      answerId: AnswerId.parse(answerId),
      userId: UserId.parse(userId),
      userWeight: weight.data,
      createdAt: now.data,
    });

    return success(vote);
  }

  public static reconstitute(props: VoteData): Vote {
    const weight = VotingWeight.safeParse(props.userWeight);

    if (!weight.success) {
      throw new Error(PollDomainCodes.INVALID_WEIGHT);
    }

    return new Vote({
      id: VoteId.parse(props.id),
      questionId: QuestionId.parse(props.questionId),
      answerId: AnswerId.parse(props.answerId),
      userId: UserId.parse(props.userId),
      userWeight: weight.data,
      createdAt: Instant.fromDate(props.createdAt),
    });
  }

  // Getters
  public get id(): VoteId {
    return this.props.id;
  }

  public get questionId(): QuestionId {
    return this.props.questionId;
  }

  public get answerId(): AnswerId {
    return this.props.answerId;
  }

  public get userId(): UserId {
    return this.props.userId;
  }

  public get userWeight(): VotingWeight {
    return this.props.userWeight;
  }

  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }
}
