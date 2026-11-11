/** Pending-invitation action responses retain invitation and actor identities. */
import type {
  getPendingAdminInvitesAction,
  getPendingBoardInvitesAction,
  getPendingMemberInvitesAction,
} from '../invitation';
import { OrganizationId } from '@/domain/shared/EntityIds';

type Data<F extends (...args: never[]) => unknown> =
  Awaited<ReturnType<F>> extends infer Result
    ? Result extends { success: true; data: infer Value }
      ? Value
      : never
    : never;
// @ts-expect-error Pending administrator invitations retain invitation identity.
const wrongAdminInvite: Data<
  typeof getPendingAdminInvitesAction
>[number]['id'] = OrganizationId.parse('org');
// @ts-expect-error Pending board invitations retain the invited user's identity.
const wrongBoardInvitee: Data<
  typeof getPendingBoardInvitesAction
>[number]['inviteeId'] = OrganizationId.parse('org');
// @ts-expect-error Pending membership invitations retain the inviting user's identity.
const wrongMemberInviter: Data<
  typeof getPendingMemberInvitesAction
>[number]['inviterId'] = OrganizationId.parse('org');
