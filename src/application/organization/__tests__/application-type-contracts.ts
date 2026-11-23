/** Public application clients reject arbitrary error messages; each operation
 * must retain known context and dependency failures. */
import { AddOrgAdminUseCase } from '../AddOrgAdminUseCase';
import { ApprovePropertyClaimUseCase } from '../ApprovePropertyClaimUseCase';
import { ArchiveAssetUseCase } from '../ArchiveAssetUseCase';
import { ArchiveOrganizationUseCase } from '../ArchiveOrganizationUseCase';
import { ArchivePropertyUseCase } from '../ArchivePropertyUseCase';
import { CancelJoinParentRequestUseCase } from '../CancelJoinParentRequestUseCase';
import { CancelJoinRequestUseCase } from '../CancelJoinRequestUseCase';
import { CorrectOwnershipUseCase } from '../CorrectOwnershipUseCase';
import { CreateAssetUseCase } from '../CreateAssetUseCase';
import { CreateJoinTokenUseCase } from '../CreateJoinTokenUseCase';
import { CreateOrganizationUseCase } from '../CreateOrganizationUseCase';
import { CreatePropertyUseCase } from '../CreatePropertyUseCase';
import { DenyPropertyClaimUseCase } from '../DenyPropertyClaimUseCase';
import { ExpireJoinTokenUseCase } from '../ExpireJoinTokenUseCase';
import { GetAdminOrganizationsUseCase } from '../GetAdminOrganizationsUseCase';
import { GetAllJoinParentRequestsUseCase } from '../GetAllJoinParentRequestsUseCase';
import { GetChildOrgJoinParentRequestUseCase } from '../GetChildOrgJoinParentRequestUseCase';
import { GetIncomingJoinParentRequestsUseCase } from '../GetIncomingJoinParentRequestsUseCase';
import { GetJoinTokenPublicInfoUseCase } from '../GetJoinTokenPublicInfoUseCase';
import { GetJoinTokensByOrgUseCase } from '../GetJoinTokensByOrgUseCase';
import { GetOrgAdminsPaginatedUseCase } from '../GetOrgAdminsPaginatedUseCase';
import { GetOrgMembersUseCase } from '../GetOrgMembersUseCase';
import { GetOrganizationDetailsUseCase } from '../GetOrganizationDetailsUseCase';
import { GetOrganizationPendingRequestsUseCase } from '../GetOrganizationPendingRequestsUseCase';
import { GetPendingRequestsUseCase } from '../GetPendingRequestsUseCase';
import { GetUserOrganizationsUseCase } from '../GetUserOrganizationsUseCase';
import { HandleJoinParentRequestUseCase } from '../HandleJoinParentRequestUseCase';
import { HandleJoinRequestUseCase } from '../HandleJoinRequestUseCase';
import { JoinOrganizationUseCase } from '../JoinOrganizationUseCase';
import { LeaveOrganizationUseCase } from '../LeaveOrganizationUseCase';
import { ListClaimableAssetsUseCase } from '../ListClaimableAssetsUseCase';
import { ListOrgPropertiesForMemberUseCase } from '../ListOrgPropertiesForMemberUseCase';
import { ListOrganizationsUseCase } from '../ListOrganizationsUseCase';
import { ReactivateJoinTokenUseCase } from '../ReactivateJoinTokenUseCase';
import { RemoveOrgAdminUseCase } from '../RemoveOrgAdminUseCase';
import { RemoveOrgMemberUseCase } from '../RemoveOrgMemberUseCase';
import { ReplaceAssetOwnersUseCase } from '../ReplaceAssetOwnersUseCase';
import { RequestJoinParentUseCase } from '../RequestJoinParentUseCase';
import { SearchOrgTreeMembersUseCase } from '../SearchOrgTreeMembersUseCase';
import { SearchOrganizationsUseCase } from '../SearchOrganizationsUseCase';
import { SubmitPropertyClaimUseCase } from '../SubmitPropertyClaimUseCase';
import { UnarchiveAssetUseCase } from '../UnarchiveAssetUseCase';
import { UnarchiveOrganizationUseCase } from '../UnarchiveOrganizationUseCase';
import { UnarchivePropertyUseCase } from '../UnarchivePropertyUseCase';
import { UpdateAssetUseCase } from '../UpdateAssetUseCase';
import { UpdateJoinTokenMaxUsesUseCase } from '../UpdateJoinTokenMaxUsesUseCase';
import { UpdateOrganizationUseCase } from '../UpdateOrganizationUseCase';
import { UpdatePropertyUseCase } from '../UpdatePropertyUseCase';
import { UseJoinTokenUseCase } from '../UseJoinTokenUseCase';
type Operations =
  | AddOrgAdminUseCase
  | ApprovePropertyClaimUseCase
  | ArchiveAssetUseCase
  | ArchiveOrganizationUseCase
  | ArchivePropertyUseCase
  | CancelJoinParentRequestUseCase
  | CancelJoinRequestUseCase
  | CorrectOwnershipUseCase
  | CreateAssetUseCase
  | CreateJoinTokenUseCase
  | CreateOrganizationUseCase
  | CreatePropertyUseCase
  | DenyPropertyClaimUseCase
  | ExpireJoinTokenUseCase
  | GetAdminOrganizationsUseCase
  | GetAllJoinParentRequestsUseCase
  | GetChildOrgJoinParentRequestUseCase
  | GetIncomingJoinParentRequestsUseCase
  | GetJoinTokenPublicInfoUseCase
  | GetJoinTokensByOrgUseCase
  | GetOrgAdminsPaginatedUseCase
  | GetOrgMembersUseCase
  | GetOrganizationDetailsUseCase
  | GetOrganizationPendingRequestsUseCase
  | GetPendingRequestsUseCase
  | GetUserOrganizationsUseCase
  | HandleJoinParentRequestUseCase
  | HandleJoinRequestUseCase
  | JoinOrganizationUseCase
  | LeaveOrganizationUseCase
  | ListClaimableAssetsUseCase
  | ListOrgPropertiesForMemberUseCase
  | ListOrganizationsUseCase
  | ReactivateJoinTokenUseCase
  | RemoveOrgAdminUseCase
  | RemoveOrgMemberUseCase
  | ReplaceAssetOwnersUseCase
  | RequestJoinParentUseCase
  | SearchOrgTreeMembersUseCase
  | SearchOrganizationsUseCase
  | SubmitPropertyClaimUseCase
  | UnarchiveAssetUseCase
  | UnarchiveOrganizationUseCase
  | UnarchivePropertyUseCase
  | UpdateAssetUseCase
  | UpdateJoinTokenMaxUsesUseCase
  | UpdateOrganizationUseCase
  | UpdatePropertyUseCase
  | UseJoinTokenUseCase;
type FailureOf<T> = T extends { success: false; error: infer E } ? E : never;
type OperationFailure = FailureOf<Awaited<ReturnType<Operations['execute']>>>;
// @ts-expect-error Application failures must be known codes.
const unknownFailure: OperationFailure = 'arbitrary failure';

import { PageSize, ResultCount } from '../../../domain/shared/Pagination';
type ResultValue<T> = T extends { success: true; value: infer V } ? V : never;
type QueryTotal<T> =
  ResultValue<Awaited<T>> extends { totalCount: infer C } ? C : never;
// @ts-expect-error Organization list totals cannot be page sizes.
const listCount: QueryTotal<ReturnType<ListOrganizationsUseCase['execute']>> =
  PageSize.parse(20);
// @ts-expect-error Join-link search totals cannot be page sizes.
const linkCount: QueryTotal<ReturnType<GetJoinTokensByOrgUseCase['execute']>> =
  PageSize.parse(20);
// @ts-expect-error Member search totals cannot be page sizes.
const memberCount: QueryTotal<ReturnType<GetOrgMembersUseCase['execute']>> =
  PageSize.parse(20);
// @ts-expect-error Administrator search totals cannot be page sizes.
const adminCount: QueryTotal<
  ReturnType<GetOrgAdminsPaginatedUseCase['execute']>
> = PageSize.parse(20);
// @ts-expect-error Pending request totals cannot be page sizes.
const pendingCount: QueryTotal<
  ReturnType<GetPendingRequestsUseCase['execute']>
> = PageSize.parse(20);
// @ts-expect-error Organization-specific request totals cannot be page sizes.
const organizationPendingCount: QueryTotal<
  ReturnType<GetOrganizationPendingRequestsUseCase['execute']>
> = PageSize.parse(20);
type PublicInfo = ResultValue<
  Awaited<ReturnType<GetJoinTokenPublicInfoUseCase['execute']>>
>;
// @ts-expect-error Search totals cannot substitute for the organization membership count.
const publicMemberCount: PublicInfo['memberCount'] = ResultCount.parse(20);

type OrganizationDetails = ResultValue<
  Awaited<ReturnType<GetOrganizationDetailsUseCase['execute']>>
>;
// @ts-expect-error Search totals cannot substitute for board membership counts.
const boardMemberCount: OrganizationDetails['boards'][number]['memberCount'] =
  ResultCount.parse(20);

import {
  OrganizationDirectory,
  DirectoryMember,
  DirectoryAdmin,
  DirectoryPerson,
} from '../OrganizationDirectory';
import {
  BoardId,
  OrganizationId,
  UserId,
} from '../../../domain/shared/EntityIds';
import { LastName } from '../../../domain/user/UserValues';
declare const directory: OrganizationDirectory;
// @ts-expect-error Board reads require board IDs, not organization IDs.
directory.boardMembers(OrganizationId.parse('org'));
// @ts-expect-error Member reads require organization IDs, not user IDs.
directory.countAcceptedMembers(UserId.parse('user'));
// @ts-expect-error First administrators belong to organizations, not boards.
directory.firstAdmin(BoardId.parse('board'));
// @ts-expect-error Names keep their meaning across directory projections.
const firstName: DirectoryPerson['firstName'] = LastName.parse('Smith');
// @ts-expect-error Mutable dates cannot enter member projections.
const joinedAt: DirectoryMember['joinedAt'] = new Date();
// @ts-expect-error Unvalidated nickname text cannot enter admin projections.
const nickname: DirectoryAdmin['nickname'] = 'unchecked';

import { PendingRequest as InboxRequest } from '../GetPendingRequestsUseCase';
import { PendingRequest as OrganizationRequest } from '../GetOrganizationPendingRequestsUseCase';
// @ts-expect-error Inbox projections require immutable timestamps.
const inboxTime: InboxRequest['requestedAt'] = new Date();
// @ts-expect-error Organization request projections require immutable timestamps.
const requestTime: OrganizationRequest['requestedAt'] = new Date();
// @ts-expect-error Requester names cannot be arbitrary unvalidated strings.
const requesterName: InboxRequest['requester']['firstName'] = 'unchecked';

type CreatedToken = Extract<
  Awaited<ReturnType<CreateJoinTokenUseCase['execute']>>,
  { success: true }
>['value'];
// @ts-expect-error Creation results retain token identities rather than raw storage IDs.
const rawCreatedId: CreatedToken['id'] = 'join-token';
// @ts-expect-error Creation results retain validated use counts.
const rawCreatedCount: CreatedToken['useCount'] = -1;
// @ts-expect-error Generated join tokens retain their constrained alphabet and length.
const rawCreatedToken: CreatedToken['token'] = 'invalid';
