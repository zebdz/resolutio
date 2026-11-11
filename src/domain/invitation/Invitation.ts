/** Invitation aggregate validates its recipient, target and lifecycle together.
 * IDs and times come from callers; raw persistence records cannot bypass invariants. */
import { z } from 'zod';
import { Result, success, failure } from '../shared/Result';
import {
  InvitationDomainCodes,
  InvitationDomainCode,
} from './InvitationDomainCodes';
import {
  InvitationId,
  OrganizationId,
  BoardId,
  UserId,
} from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import { EntityCreation } from '../shared/EntityCreation';

export const InvitationType = z.enum([
  'admin_invite',
  'board_member_invite',
  'member_invite',
]);
export type InvitationType = z.infer<typeof InvitationType>;
export const InvitationStatus = z.enum([
  'pending',
  'accepted',
  'declined',
  'revoked',
]);
export type InvitationStatus = z.infer<typeof InvitationStatus>;
export const InvitationTarget = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('board_member_invite'), boardId: BoardId })
    .readonly(),
  z
    .object({
      type: z.enum(['admin_invite', 'member_invite']),
      boardId: z.null(),
    })
    .readonly(),
]);
export type InvitationTarget = z.infer<typeof InvitationTarget>;
type InvitationLifecycle =
  | { readonly status: 'pending'; readonly handledAt: null }
  | {
      readonly status: 'accepted' | 'declined' | 'revoked';
      readonly handledAt: Instant;
    };

export interface InvitationData {
  id: string;
  organizationId: string;
  boardId: string | null;
  inviterId: string;
  inviteeId: string;
  type: string;
  status: string;
  createdAt: Date;
  handledAt: Date | null;
}

interface InvitationProps {
  readonly id: InvitationId;
  readonly organizationId: OrganizationId;
  readonly inviterId: UserId;
  readonly inviteeId: UserId;
  readonly target: InvitationTarget;
  readonly createdAt: Instant;
}

export class Invitation {
  private constructor(
    private readonly props: InvitationProps,
    private lifecycle: InvitationLifecycle
  ) {}

  public static create(
    organizationId: OrganizationId,
    inviterId: UserId,
    inviteeId: UserId,
    target: InvitationTarget,
    creation: EntityCreation<InvitationId>
  ): Invitation {
    return new Invitation(
      {
        id: InvitationId.parse(creation.id),
        organizationId: OrganizationId.parse(organizationId),
        inviterId: UserId.parse(inviterId),
        inviteeId: UserId.parse(inviteeId),
        target: InvitationTarget.parse(target),
        createdAt: Instant.parse(creation.now),
      },
      { status: 'pending', handledAt: null }
    );
  }

  public static reconstitute(data: InvitationData): Invitation {
    const status = InvitationStatus.parse(data.status);
    const props: InvitationProps = {
      id: InvitationId.parse(data.id),
      organizationId: OrganizationId.parse(data.organizationId),
      inviterId: UserId.parse(data.inviterId),
      inviteeId: UserId.parse(data.inviteeId),
      target: InvitationTarget.parse({
        type: data.type,
        boardId: data.boardId,
      }),
      createdAt: Instant.fromDate(data.createdAt),
    };

    if (status === 'pending') {
      if (data.handledAt !== null) {
        throw new Error(InvitationDomainCodes.INVALID_DATA);
      }

      return new Invitation(props, { status, handledAt: null });
    }

    if (data.handledAt === null) {
      throw new Error(InvitationDomainCodes.INVALID_DATA);
    }

    return new Invitation(props, {
      status,
      handledAt: Instant.fromDate(data.handledAt),
    });
  }

  public get id(): InvitationId {
    return this.props.id;
  }
  public get organizationId(): OrganizationId {
    return this.props.organizationId;
  }
  public get boardId(): BoardId | null {
    return this.props.target.boardId;
  }
  public get inviterId(): UserId {
    return this.props.inviterId;
  }
  public get inviteeId(): UserId {
    return this.props.inviteeId;
  }
  public get type(): InvitationType {
    return this.props.target.type;
  }
  public get target(): InvitationTarget {
    return this.props.target;
  }
  public get status(): InvitationStatus {
    return this.lifecycle.status;
  }
  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }
  public get handledAt(): Date | null {
    return this.lifecycle.handledAt === null
      ? null
      : Instant.toDate(this.lifecycle.handledAt);
  }
  public isPending(): boolean {
    return this.lifecycle.status === 'pending';
  }

  public accept(at: Instant): Result<void, InvitationDomainCode> {
    return this.handle('accepted', at);
  }
  public decline(at: Instant): Result<void, InvitationDomainCode> {
    return this.handle('declined', at);
  }
  public revoke(at: Instant): Result<void, InvitationDomainCode> {
    return this.handle('revoked', at);
  }

  private handle(
    status: Exclude<InvitationStatus, 'pending'>,
    at: Instant
  ): Result<void, InvitationDomainCode> {
    if (!this.isPending()) {
      return failure(InvitationDomainCodes.NOT_PENDING);
    }

    const instant = Instant.safeParse(at);

    if (!instant.success) {
      return failure(InvitationDomainCodes.INVALID_DATA);
    }

    this.lifecycle = { status, handledAt: instant.data };

    return success(undefined);
  }

  public toJSON(): InvitationData {
    return {
      id: this.id,
      organizationId: this.organizationId,
      inviterId: this.inviterId,
      inviteeId: this.inviteeId,
      ...this.target,
      status: this.status,
      createdAt: this.createdAt,
      handledAt: this.handledAt,
    };
  }
}
