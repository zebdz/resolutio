/** Typed invitation persistence keeps target/lifecycle decoding at the boundary. */
import {
  InvitationId,
  OrganizationId,
  BoardId,
  UserId,
} from '@/domain/shared/EntityIds';
import { Invitation, InvitationType } from './Invitation';

export interface InvitationRepository {
  save(invitation: Invitation): Promise<Invitation>;
  update(invitation: Invitation): Promise<Invitation>;
  findById(id: InvitationId): Promise<Invitation | null>;
  findPendingByInviteeId(inviteeId: UserId): Promise<Invitation[]>;
  findPendingByOrganizationId(
    organizationId: OrganizationId,
    type: InvitationType
  ): Promise<Invitation[]>;
  findPendingByBoardId(boardId: BoardId): Promise<Invitation[]>;
  findPendingAdminInvite(
    organizationId: OrganizationId,
    inviteeId: UserId
  ): Promise<Invitation | null>;
  findPendingBoardMemberInvite(
    boardId: BoardId,
    inviteeId: UserId
  ): Promise<Invitation | null>;
  findPendingMemberInvite(
    organizationId: OrganizationId,
    inviteeId: UserId
  ): Promise<Invitation | null>;
}
