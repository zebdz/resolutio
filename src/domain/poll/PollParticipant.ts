import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes } from './PollDomainCodes';

export interface PollParticipantProps {
  id: string;
  pollId: string;
  userId: string;
  userWeight: number;
  snapshotAt: Date;
  createdAt: Date;
}

export interface WeightChangeEvent {
  oldWeight: number;
  newWeight: number;
}

export class PollParticipant {
  private constructor(private props: PollParticipantProps) {}

  public static create(
    pollId: string,
    userId: string,
    userWeight: number = 1.0
  ): Result<PollParticipant, string> {
    if (userWeight < 0) {
      return failure(PollDomainCodes.INVALID_WEIGHT);
    }

    const participant = new PollParticipant({
      id: '',
      pollId,
      userId,
      userWeight,
      snapshotAt: new Date(),
      createdAt: new Date(),
    });

    return success(participant);
  }

  public static reconstitute(props: PollParticipantProps): PollParticipant {
    return new PollParticipant(props);
  }

  // Getters
  public get id(): string {
    return this.props.id;
  }

  public get pollId(): string {
    return this.props.pollId;
  }

  public get userId(): string {
    return this.props.userId;
  }

  public get userWeight(): number {
    return this.props.userWeight;
  }

  public get snapshotAt(): Date {
    return this.props.snapshotAt;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  // Business logic
  public updateWeight(newWeight: number): Result<WeightChangeEvent, string> {
    if (newWeight < 0) {
      return failure(PollDomainCodes.INVALID_WEIGHT);
    }

    const oldWeight = this.props.userWeight;
    this.props.userWeight = newWeight;

    return success({
      oldWeight,
      newWeight,
    });
  }
}
