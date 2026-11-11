/** Draft selection owns its validated identity and immutable timestamps.
 * Creation and refresh receive explicit time; transport/persistence Dates are detached. */
import {
  VoteDraftId,
  PollId,
  QuestionId,
  AnswerId,
  UserId,
} from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes, PollDomainCode } from './PollDomainCodes';

export interface VoteDraftProps {
  readonly id: VoteDraftId;
  readonly pollId: PollId;
  readonly questionId: QuestionId;
  readonly answerId: AnswerId;
  readonly userId: UserId;
  readonly createdAt: Instant;
  updatedAt: Instant;
}

/** Raw persistence values are decoded before they become a draft entity. */
export interface VoteDraftData {
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
    pollId: PollId,
    questionId: QuestionId,
    answerId: AnswerId,
    userId: UserId,
    creation: EntityCreation<VoteDraftId>
  ): Result<VoteDraft, PollDomainCode> {
    const now = Instant.parse(creation.now);
    const draft = new VoteDraft({
      id: VoteDraftId.parse(creation.id),
      pollId: PollId.parse(pollId),
      questionId: QuestionId.parse(questionId),
      answerId: AnswerId.parse(answerId),
      userId: UserId.parse(userId),
      createdAt: now,
      updatedAt: now,
    });

    return success(draft);
  }

  public static reconstitute(props: VoteDraftData): VoteDraft {
    return new VoteDraft({
      id: VoteDraftId.parse(props.id),
      pollId: PollId.parse(props.pollId),
      questionId: QuestionId.parse(props.questionId),
      answerId: AnswerId.parse(props.answerId),
      userId: UserId.parse(props.userId),
      createdAt: Instant.fromDate(props.createdAt),
      updatedAt: Instant.fromDate(props.updatedAt),
    });
  }

  // Getters
  public get id(): VoteDraftId {
    return this.props.id;
  }

  public get pollId(): PollId {
    return this.props.pollId;
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

  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }

  public get updatedAt(): Date {
    return Instant.toDate(this.props.updatedAt);
  }

  public touch(at: Instant): void {
    this.props.updatedAt = Instant.parse(at);
  }
}
