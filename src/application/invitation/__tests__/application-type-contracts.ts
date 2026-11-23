/** Public application clients reject arbitrary error messages; each operation
 * must retain known context and dependency failures. */
import { CreateAdminInviteUseCase } from '../CreateAdminInviteUseCase';
import { CreateBoardMemberInviteUseCase } from '../CreateBoardMemberInviteUseCase';
import { CreateOrgMemberInviteUseCase } from '../CreateOrgMemberInviteUseCase';
import {
  GetInviteDetailsUseCase,
  InviteDetails,
} from '../GetInviteDetailsUseCase';
import {
  InvitationId,
  OrganizationId,
  UserId,
} from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { OrganizationName } from '@/domain/organization/OrganizationValues';
import { BoardName } from '@/domain/board/BoardName';
import { GetPendingAdminInvitesUseCase } from '../GetPendingAdminInvitesUseCase';
import { GetPendingBoardInvitesUseCase } from '../GetPendingBoardInvitesUseCase';
import { GetPendingMemberInvitesUseCase } from '../GetPendingMemberInvitesUseCase';
import { GetUserPendingInvitesUseCase } from '../GetUserPendingInvitesUseCase';
import { HandleInviteUseCase } from '../HandleInviteUseCase';
import { RevokeInviteUseCase } from '../RevokeInviteUseCase';
type Operations =
  | CreateAdminInviteUseCase
  | CreateBoardMemberInviteUseCase
  | CreateOrgMemberInviteUseCase
  | GetInviteDetailsUseCase
  | GetPendingAdminInvitesUseCase
  | GetPendingBoardInvitesUseCase
  | GetPendingMemberInvitesUseCase
  | GetUserPendingInvitesUseCase
  | HandleInviteUseCase
  | RevokeInviteUseCase;
type FailureOf<T> = T extends { success: false; error: infer E } ? E : never;
type OperationFailure = FailureOf<Awaited<ReturnType<Operations['execute']>>>;
// @ts-expect-error Application failures must be known codes.
const unknownFailure: OperationFailure = 'arbitrary failure';

declare const detail: InviteDetails;
const invitationId: InvitationId = detail.id;
const organizationId: OrganizationId = detail.organizationId;
const inviteeId: UserId = detail.inviteeId;
const createdAt: Instant = detail.createdAt;
const organizationName: OrganizationName | null = detail.organizationName;
const boardName: BoardName | null = detail.boardName;
// @ts-expect-error Different identities cannot substitute for invitation IDs.
const wrongIdentity: InviteDetails['id'] = UserId.parse('user');
// @ts-expect-error Unvalidated dates cannot enter application read models.
const wrongTime: InviteDetails['createdAt'] = new Date();
// @ts-expect-error Organization names must be validated or explicitly absent.
const blankName: InviteDetails['organizationName'] = '';
// @ts-expect-error A board invitation requires its board identity.
const missingBoard: InviteDetails = {
  ...detail,
  type: 'board_member_invite',
  boardId: null,
};
