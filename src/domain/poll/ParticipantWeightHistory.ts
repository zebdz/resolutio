import { Result, success, failure } from '../shared/Result';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';

export interface ParticipantWeightHistoryProps {
  id: string;
  participantId: string;
  pollId: string;
  userId: string;
  oldWeight: number;
  newWeight: number;
  changedBy: string;
  reason: string | null;
  changedAt: Date;
}

export class ParticipantWeightHistory {
  private constructor(private props: ParticipantWeightHistoryProps) {}

  public static create(
    participantId: string,
    pollId: string,
    userId: string,
    oldWeight: number,
    newWeight: number,
    changedBy: string,
    reason: string | null = null,
    profanityChecker?: ProfanityChecker
  ): Result<ParticipantWeightHistory, string> {
    if (reason && profanityChecker?.containsProfanity(reason)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    const history = new ParticipantWeightHistory({
      id: '',
      participantId,
      pollId,
      userId,
      oldWeight,
      newWeight,
      changedBy,
      reason,
      changedAt: new Date(),
    });

    return success(history);
  }

  public static reconstitute(
    props: ParticipantWeightHistoryProps
  ): ParticipantWeightHistory {
    return new ParticipantWeightHistory(props);
  }

  // Getters
  public get id(): string {
    return this.props.id;
  }

  public get participantId(): string {
    return this.props.participantId;
  }

  public get pollId(): string {
    return this.props.pollId;
  }

  public get userId(): string {
    return this.props.userId;
  }

  public get oldWeight(): number {
    return this.props.oldWeight;
  }

  public get newWeight(): number {
    return this.props.newWeight;
  }

  public get changedBy(): string {
    return this.props.changedBy;
  }

  public get reason(): string | null {
    return this.props.reason;
  }

  public get changedAt(): Date {
    return this.props.changedAt;
  }
}
