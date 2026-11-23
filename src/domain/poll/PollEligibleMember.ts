/** Immutable membership ceiling captured when a poll snapshot is prepared.
 * Identity and capture time arrive explicitly; persisted values are validated. */
import { PollEligibleMemberId, PollId, UserId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';

export interface PollEligibleMemberProps {
  readonly id: PollEligibleMemberId;
  readonly pollId: PollId;
  readonly userId: UserId;
  readonly snapshotAt: Instant;
  readonly createdAt: Instant;
}

/** Raw storage boundary, decoded before creating an eligibility record. */
export interface PollEligibleMemberData {
  id: string;
  pollId: string;
  userId: string;
  snapshotAt: Date;
  createdAt: Date;
}

export class PollEligibleMember {
  private readonly props: Readonly<PollEligibleMemberProps>;
  private constructor(props: PollEligibleMemberProps) {
    this.props = Object.freeze({ ...props });
  }

  public static create(
    pollId: PollId,
    userId: UserId,
    creation: EntityCreation<PollEligibleMemberId>
  ): PollEligibleMember {
    return new PollEligibleMember({
      id: PollEligibleMemberId.parse(creation.id),
      pollId: PollId.parse(pollId),
      userId: UserId.parse(userId),
      snapshotAt: Instant.parse(creation.now),
      createdAt: Instant.parse(creation.now),
    });
  }

  public static reconstitute(data: PollEligibleMemberData): PollEligibleMember {
    return new PollEligibleMember({
      id: PollEligibleMemberId.parse(data.id),
      pollId: PollId.parse(data.pollId),
      userId: UserId.parse(data.userId),
      snapshotAt: Instant.fromDate(data.snapshotAt),
      createdAt: Instant.fromDate(data.createdAt),
    });
  }

  public get id(): PollEligibleMemberId {
    return this.props.id;
  }
  public get pollId(): PollId {
    return this.props.pollId;
  }
  public get userId(): UserId {
    return this.props.userId;
  }
  public get snapshotAt(): Date {
    return Instant.toDate(this.props.snapshotAt);
  }
  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }
}
