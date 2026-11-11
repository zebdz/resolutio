/** Explicit invitation browser projection. Keeps historical Date/label payloads
 * while application reads use immutable instants and nullable related names. */
import type { InviteDetails } from '@/application/invitation/InviteDetails';
import { Instant } from '@/domain/shared/Instant';
import type { Invitation } from '@/domain/invitation/Invitation';

export type PendingInviteView = Pick<
  Invitation,
  'id' | 'inviteeId' | 'inviterId' | 'createdAt'
>;

export function serializeInviteDetails(detail: InviteDetails) {
  return {
    id: detail.id,
    type: detail.type,
    status: detail.status,
    organizationName: detail.organizationName ?? '',
    organizationId: detail.organizationId,
    boardName: detail.boardName,
    boardId: detail.boardId,
    inviterName: detail.inviterName ?? '',
    inviteeId: detail.inviteeId,
    createdAt: Instant.toDate(detail.createdAt),
  };
}

export type InviteDetailsDto = ReturnType<typeof serializeInviteDetails>;
