/** Snapshot participant with a typed voting weight and ballot credential. A receipt secret is supplied
 * externally and cannot be replaced once assigned. Identity/time are explicit. */
import { PollId, UserId, ParticipantId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { Result, success, failure } from '../shared/Result';
import { ReceiptSecret } from './ReceiptSecret';
import { PollDomainCodes, PollDomainCode } from './PollDomainCodes';
import { VotingWeight } from './VotingWeight';
import { z } from 'zod';

export interface PollParticipantProps {
  readonly id: ParticipantId;
  readonly pollId: PollId;
  readonly userId: UserId;
  userWeight: VotingWeight;
  willingToSignProtocol: boolean | null;
  readonly snapshotAt: Instant;
  readonly createdAt: Instant;
  receiptSecret: ReceiptSecret | null;
}

/** Raw persistence values are decoded before entering participant state. */
export interface PollParticipantData {
  id: string;
  pollId: string;
  userId: string;
  userWeight: number;
  willingToSignProtocol: boolean | null;
  snapshotAt: Date;
  createdAt: Date;
  receiptSecret?: string | null;
}

export interface WeightChangeEvent {
  readonly oldWeight: VotingWeight;
  readonly newWeight: VotingWeight;
}

export class PollParticipant {
  private constructor(private props: PollParticipantProps) {}

  public get receiptSecret(): ReceiptSecret | null {
    return this.props.receiptSecret;
  }

  public assignReceiptSecret(
    secret: ReceiptSecret
  ): Result<void, PollDomainCode> {
    const parsed = ReceiptSecret.safeParse(secret);

    if (
      !parsed.success ||
      (this.props.receiptSecret !== null &&
        this.props.receiptSecret !== parsed.data)
    ) {
      return failure(PollDomainCodes.RECEIPT_SECRET_IMMUTABLE);
    }

    this.props.receiptSecret = parsed.data;

    return success(undefined);
  }

  public static create(
    pollId: PollId,
    userId: UserId,
    creation: EntityCreation<ParticipantId>,
    userWeight: VotingWeight = VotingWeight.parse(1)
  ): Result<PollParticipant, PollDomainCode> {
    const weight = VotingWeight.safeParse(userWeight);

    if (!weight.success) {
      return failure(PollDomainCodes.INVALID_WEIGHT);
    }

    const participant = new PollParticipant({
      id: ParticipantId.parse(creation.id),
      pollId: PollId.parse(pollId),
      userId: UserId.parse(userId),
      userWeight: weight.data,
      willingToSignProtocol: null,
      receiptSecret: null,
      snapshotAt: Instant.parse(creation.now),
      createdAt: Instant.parse(creation.now),
    });

    return success(participant);
  }

  public static reconstitute(props: PollParticipantData): PollParticipant {
    const weight = VotingWeight.safeParse(props.userWeight);

    if (!weight.success) {
      throw new Error(PollDomainCodes.INVALID_WEIGHT);
    }

    return new PollParticipant({
      userWeight: weight.data,
      id: ParticipantId.parse(props.id),
      pollId: PollId.parse(props.pollId),
      userId: UserId.parse(props.userId),
      snapshotAt: Instant.fromDate(props.snapshotAt),
      createdAt: Instant.fromDate(props.createdAt),
      willingToSignProtocol: z
        .boolean()
        .nullable()
        .parse(props.willingToSignProtocol),
      receiptSecret:
        props.receiptSecret == null
          ? null
          : ReceiptSecret.parse(props.receiptSecret),
    });
  }

  // Getters
  public get id(): ParticipantId {
    return this.props.id;
  }

  public get pollId(): PollId {
    return this.props.pollId;
  }

  public get userId(): UserId {
    return this.props.userId;
  }

  public get userWeight(): VotingWeight {
    return this.props.userWeight;
  }

  public get snapshotAt(): Date {
    return Instant.toDate(this.props.snapshotAt);
  }

  public get willingToSignProtocol(): boolean | null {
    return this.props.willingToSignProtocol;
  }

  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }

  // Business logic
  public setWillingToSignProtocol(value: boolean): void {
    this.props.willingToSignProtocol = z.boolean().parse(value);
  }
  public updateWeight(
    newWeight: VotingWeight
  ): Result<WeightChangeEvent, PollDomainCode> {
    const weight = VotingWeight.safeParse(newWeight);

    if (!weight.success) {
      return failure(PollDomainCodes.INVALID_WEIGHT);
    }

    const oldWeight = this.props.userWeight;
    this.props.userWeight = weight.data;

    return success({
      oldWeight,
      newWeight: weight.data,
    });
  }
}
