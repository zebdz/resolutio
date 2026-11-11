/** Invitation read model preserves identity, target variants and immutable time.
 * Unresolved related records remain explicit; display fallbacks belong to the web. */
import {
  Invitation,
  InvitationStatus,
  InvitationTarget,
} from '@/domain/invitation/Invitation';
import {
  InvitationId,
  OrganizationId,
  UserId,
} from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { OrganizationName } from '@/domain/organization/OrganizationValues';
import { BoardName } from '@/domain/board/BoardName';

export type InviteDetails = Readonly<{
  id: InvitationId;
  status: InvitationStatus;
  organizationName: OrganizationName | null;
  organizationId: OrganizationId;
  inviterName: string | null;
  inviteeId: UserId;
  createdAt: Instant;
}> &
  (
    | (Extract<InvitationTarget, { type: 'board_member_invite' }> & {
        readonly boardName: BoardName | null;
      })
    | (Exclude<InvitationTarget, { type: 'board_member_invite' }> & {
        readonly boardName: null;
      })
  );

export function invitationDetails(
  invitation: Invitation,
  names: {
    readonly organization: OrganizationName | null;
    readonly board: BoardName | null;
    readonly inviter: string | null;
  }
): InviteDetails {
  const common = {
    id: invitation.id,
    status: invitation.status,
    organizationName: names.organization,
    organizationId: invitation.organizationId,
    inviterName: names.inviter,
    inviteeId: invitation.inviteeId,
    createdAt: Instant.fromDate(invitation.createdAt),
  };
  const target = invitation.target;

  return target.type === 'board_member_invite'
    ? { ...common, ...target, boardName: names.board }
    : { ...common, ...target, boardName: null };
}
