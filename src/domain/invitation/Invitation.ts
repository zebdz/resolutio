import { Result, success, failure } from '../shared/Result';
import { InvitationDomainCodes } from './InvitationDomainCodes';

export type InvitationType =
  | 'admin_invite'
  | 'board_member_invite'
  | 'member_invite';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

export interface InvitationProps {
  id: string;
  organizationId: string;
  boardId: string | null;
  inviterId: string;
  inviteeId: string;
  type: InvitationType;
  status: InvitationStatus;
  createdAt: Date;
  handledAt: Date | null;
}

export class Invitation {
  private constructor(private props: InvitationProps) {}

  public static create(
    organizationId: string,
    inviterId: string,
    inviteeId: string,
    type: InvitationType,
    boardId: string | null = null
  ): Invitation {
    return new Invitation({
      id: '',
      organizationId,
      boardId,
      inviterId,
      inviteeId,
      type,
      status: 'pending',
      createdAt: new Date(),
      handledAt: null,
    });
  }

  public static reconstitute(props: InvitationProps): Invitation {
    return new Invitation(props);
  }

  public get id(): string {
    return this.props.id;
  }

  public get organizationId(): string {
    return this.props.organizationId;
  }

  public get boardId(): string | null {
    return this.props.boardId;
  }

  public get inviterId(): string {
    return this.props.inviterId;
  }

  public get inviteeId(): string {
    return this.props.inviteeId;
  }

  public get type(): InvitationType {
    return this.props.type;
  }

  public get status(): InvitationStatus {
    return this.props.status;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get handledAt(): Date | null {
    return this.props.handledAt;
  }

  public isPending(): boolean {
    return this.props.status === 'pending';
  }

  public accept(): Result<void, string> {
    if (!this.isPending()) {
      return failure(InvitationDomainCodes.NOT_PENDING);
    }

    this.props.status = 'accepted';
    this.props.handledAt = new Date();

    return success(undefined);
  }

  public decline(): Result<void, string> {
    if (!this.isPending()) {
      return failure(InvitationDomainCodes.NOT_PENDING);
    }

    this.props.status = 'declined';
    this.props.handledAt = new Date();

    return success(undefined);
  }

  public revoke(): Result<void, string> {
    if (!this.isPending()) {
      return failure(InvitationDomainCodes.NOT_PENDING);
    }

    this.props.status = 'revoked';
    this.props.handledAt = new Date();

    return success(undefined);
  }

  public toJSON(): InvitationProps {
    return {
      ...this.props,
    };
  }
}
