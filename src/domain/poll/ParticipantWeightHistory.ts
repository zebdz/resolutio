/** Immutable participant-weight audit record with explicit identity and time.
 * References are known before persistence; raw storage fields are decoded on reconstitution. */
import {
  ParticipantWeightHistoryId,
  ParticipantId,
  PollId,
  UserId,
} from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { VotingWeight } from './VotingWeight';
import { PollDomainCode, PollDomainCodes } from './PollDomainCodes';
import { z } from 'zod';
import { Result, success, failure } from '../shared/Result';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';

export interface ParticipantWeightHistoryProps {
  readonly id: ParticipantWeightHistoryId;
  readonly participantId: ParticipantId;
  readonly pollId: PollId;
  readonly userId: UserId;
  readonly oldWeight: VotingWeight;
  readonly newWeight: VotingWeight;
  readonly changedBy: UserId;
  reason: string | null;
  readonly changedAt: Instant;
}

/** Raw persisted history values; no empty participant-ID sentinel is accepted. */
export interface ParticipantWeightHistoryData {
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

export type WeightHistoryFailure =
  | PollDomainCode
  | typeof SharedDomainCodes.CONTAINS_PROFANITY;

export class ParticipantWeightHistory {
  private readonly props: Readonly<ParticipantWeightHistoryProps>;

  private constructor(props: ParticipantWeightHistoryProps) {
    this.props = Object.freeze({ ...props });
  }

  public static create(
    participantId: ParticipantId,
    pollId: PollId,
    userId: UserId,
    oldWeight: VotingWeight,
    newWeight: VotingWeight,
    changedBy: UserId,
    creation: EntityCreation<ParticipantWeightHistoryId>,
    reason: string | null = null,
    profanityChecker?: ProfanityChecker
  ): Result<ParticipantWeightHistory, WeightHistoryFailure> {
    const old = VotingWeight.safeParse(oldWeight);
    const next = VotingWeight.safeParse(newWeight);

    if (!old.success || !next.success) {
      return failure(PollDomainCodes.INVALID_WEIGHT);
    }

    if (reason && profanityChecker?.containsProfanity(reason)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    const history = new ParticipantWeightHistory({
      id: ParticipantWeightHistoryId.parse(creation.id),
      participantId: ParticipantId.parse(participantId),
      pollId: PollId.parse(pollId),
      userId: UserId.parse(userId),
      oldWeight: old.data,
      newWeight: next.data,
      changedBy: UserId.parse(changedBy),
      reason,
      changedAt: Instant.parse(creation.now),
    });

    return success(history);
  }

  public static reconstitute(
    props: ParticipantWeightHistoryData
  ): ParticipantWeightHistory {
    const old = VotingWeight.safeParse(props.oldWeight);
    const next = VotingWeight.safeParse(props.newWeight);

    if (!old.success || !next.success) {
      throw new Error(PollDomainCodes.INVALID_WEIGHT);
    }

    return new ParticipantWeightHistory({
      oldWeight: old.data,
      newWeight: next.data,
      id: ParticipantWeightHistoryId.parse(props.id),
      participantId: ParticipantId.parse(props.participantId),
      pollId: PollId.parse(props.pollId),
      userId: UserId.parse(props.userId),
      changedBy: UserId.parse(props.changedBy),
      reason: z.string().nullable().parse(props.reason),
      changedAt: Instant.fromDate(props.changedAt),
    });
  }

  // Getters
  public get id(): ParticipantWeightHistoryId {
    return this.props.id;
  }

  public get participantId(): ParticipantId {
    return this.props.participantId;
  }

  public get pollId(): PollId {
    return this.props.pollId;
  }

  public get userId(): UserId {
    return this.props.userId;
  }

  public get oldWeight(): VotingWeight {
    return this.props.oldWeight;
  }

  public get newWeight(): VotingWeight {
    return this.props.newWeight;
  }

  public get changedBy(): UserId {
    return this.props.changedBy;
  }

  public get reason(): string | null {
    return this.props.reason;
  }

  public get changedAt(): Date {
    return Instant.toDate(this.props.changedAt);
  }
}
