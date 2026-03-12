import { Invitation } from './Invitation';

export interface InvitationRepository {
  save(invitation: Invitation): Promise<Invitation>;
  update(invitation: Invitation): Promise<Invitation>;
  findById(id: string): Promise<Invitation | null>;
  findPendingByInviteeId(inviteeId: string): Promise<Invitation[]>;
  findPendingByOrganizationId(
    organizationId: string,
    type: string
  ): Promise<Invitation[]>;
  findPendingByBoardId(boardId: string): Promise<Invitation[]>;
  findPendingAdminInvite(
    organizationId: string,
    inviteeId: string
  ): Promise<Invitation | null>;
  findPendingBoardMemberInvite(
    boardId: string,
    inviteeId: string
  ): Promise<Invitation | null>;
  findPendingMemberInvite(
    organizationId: string,
    inviteeId: string
  ): Promise<Invitation | null>;
}
