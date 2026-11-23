/** Typed invitation persistence keeps target/lifecycle decoding at the boundary. */
import {
  InvitationId,
  OrganizationId,
  BoardId,
  UserId,
} from '@/domain/shared/EntityIds';
import { PrismaClient } from '@/generated/prisma/client';
import {
  Invitation,
  InvitationData,
  InvitationType,
  InvitationStatus,
} from '../../domain/invitation/Invitation';
import { InvitationRepository } from '../../domain/invitation/InvitationRepository';

export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private prisma: PrismaClient) {}

  async save(invitation: Invitation): Promise<Invitation> {
    const data = invitation.toJSON();

    const created = await this.prisma.invitation.create({
      data: {
        id: data.id,
        organizationId: data.organizationId,
        boardId: data.boardId,
        inviterId: data.inviterId,
        inviteeId: data.inviteeId,
        type: data.type,
        status: data.status,
        createdAt: data.createdAt,
        handledAt: data.handledAt,
      },
    });

    return Invitation.reconstitute(this.toProps(created));
  }

  async update(invitation: Invitation): Promise<Invitation> {
    const data = invitation.toJSON();

    const updated = await this.prisma.invitation.update({
      where: { id: data.id },
      data: {
        status: data.status,
        handledAt: data.handledAt,
      },
    });

    return Invitation.reconstitute(this.toProps(updated));
  }

  async findById(id: InvitationId): Promise<Invitation | null> {
    const record = await this.prisma.invitation.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return Invitation.reconstitute(this.toProps(record));
  }

  async findPendingByInviteeId(inviteeId: UserId): Promise<Invitation[]> {
    const records = await this.prisma.invitation.findMany({
      where: { inviteeId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => Invitation.reconstitute(this.toProps(r)));
  }

  async findPendingByOrganizationId(
    organizationId: OrganizationId,
    type: InvitationType
  ): Promise<Invitation[]> {
    const records = await this.prisma.invitation.findMany({
      where: { organizationId, type, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => Invitation.reconstitute(this.toProps(r)));
  }

  async findPendingByBoardId(boardId: BoardId): Promise<Invitation[]> {
    const records = await this.prisma.invitation.findMany({
      where: { boardId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => Invitation.reconstitute(this.toProps(r)));
  }

  async findPendingAdminInvite(
    organizationId: OrganizationId,
    inviteeId: UserId
  ): Promise<Invitation | null> {
    const record = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        inviteeId,
        type: 'admin_invite',
        status: 'pending',
      },
    });

    if (!record) {
      return null;
    }

    return Invitation.reconstitute(this.toProps(record));
  }

  async findPendingBoardMemberInvite(
    boardId: BoardId,
    inviteeId: UserId
  ): Promise<Invitation | null> {
    const record = await this.prisma.invitation.findFirst({
      where: {
        boardId,
        inviteeId,
        type: 'board_member_invite',
        status: 'pending',
      },
    });

    if (!record) {
      return null;
    }

    return Invitation.reconstitute(this.toProps(record));
  }

  async findPendingMemberInvite(
    organizationId: OrganizationId,
    inviteeId: UserId
  ): Promise<Invitation | null> {
    const record = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        inviteeId,
        type: 'member_invite',
        status: 'pending',
      },
    });

    if (!record) {
      return null;
    }

    return Invitation.reconstitute(this.toProps(record));
  }

  private toProps(record: {
    id: string;
    organizationId: string;
    boardId: string | null;
    inviterId: string;
    inviteeId: string;
    type: string;
    status: string;
    createdAt: Date;
    handledAt: Date | null;
  }): InvitationData {
    return {
      id: record.id,
      organizationId: record.organizationId,
      boardId: record.boardId,
      inviterId: record.inviterId,
      inviteeId: record.inviteeId,
      type: record.type,
      status: record.status,
      createdAt: record.createdAt,
      handledAt: record.handledAt,
    };
  }
}
