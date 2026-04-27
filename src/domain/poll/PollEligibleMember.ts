export interface PollEligibleMemberProps {
  id: string;
  pollId: string;
  userId: string;
  snapshotAt: Date;
  createdAt: Date;
}

export class PollEligibleMember {
  private constructor(private props: PollEligibleMemberProps) {}

  public static create(
    pollId: string,
    userId: string,
    snapshotAt: Date
  ): PollEligibleMember {
    return new PollEligibleMember({
      id: '',
      pollId,
      userId,
      snapshotAt,
      createdAt: new Date(),
    });
  }

  public static reconstitute(
    props: PollEligibleMemberProps
  ): PollEligibleMember {
    return new PollEligibleMember(props);
  }

  public get id(): string {
    return this.props.id;
  }

  public get pollId(): string {
    return this.props.pollId;
  }

  public get userId(): string {
    return this.props.userId;
  }

  public get snapshotAt(): Date {
    return this.props.snapshotAt;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }
}
