/** Compile-only directory clients retain organization/board identities at every tree depth.
 * The full source/test typecheck checks actual server action results. */
import type { getOrganizationDetailsAction } from '../organization';
import { UserId, OrganizationId } from '@/domain/shared/EntityIds';
import type {
  createJoinTokenAction,
  getJoinTokensByOrgAction,
  joinViaTokenAction,
} from '../joinToken';
import type {
  createOrganizationAction,
  listOrganizationsAction,
  searchOrganizationsNotAlreadyMemberOfAction,
  getAdminOrganizationsAction,
  getUserOrganizationsAction,
  getPendingRequestsAction,
  getOrganizationPendingRequestsAction,
  getUserMemberOrganizationsAction,
  searchAllOrganizationsAction,
  searchOrganizationsForJoinParentAction,
  searchOrganizationsForFilterAction,
  getOrgPropertiesAction,
  getOrgPropertiesTreeAction,
  searchUsersForMemberInviteAction,
} from '../organization';

type Data<F extends (...args: never[]) => unknown> =
  Awaited<ReturnType<F>> extends infer Result
    ? Result extends { success: true; data: infer Value }
      ? Value
      : never
    : never;
// @ts-expect-error Created links retain their validated token syntax.
const rawToken: Data<typeof createJoinTokenAction>['token'] = 'bad';
// @ts-expect-error Listed usage limits retain their positive-integer unit.
const rawTokenLimit: Data<
  typeof getJoinTokensByOrgAction
>['tokens'][number]['maxUses'] = -1;
// @ts-expect-error Link-list counts retain their validated unit.
const rawTokenCount: Data<typeof getJoinTokensByOrgAction>['totalCount'] = -1;
// @ts-expect-error Redeemed links refer to validated organization identities.
const rawJoinedOrg: Data<typeof joinViaTokenAction>['organizationId'] = 'org';
// @ts-expect-error Newly created organization references retain identity.
const rawCreated: Data<typeof createOrganizationAction>['organizationId'] =
  'org';
// @ts-expect-error Directory lists retain organization identity.
const rawList: Data<
  typeof listOrganizationsAction
>['organizations'][number]['id'] = 'org';
// @ts-expect-error Directory totals retain their count unit.
const rawSearchCount: Data<
  typeof searchOrganizationsNotAlreadyMemberOfAction
>['totalCount'] = -1;
// @ts-expect-error Admin lists retain organization identity.
const rawAdminOrg: Data<
  typeof getAdminOrganizationsAction
>['organizations'][number]['id'] = 'org';
// @ts-expect-error Membership lists retain organization identity.
const rawMemberOrg: Data<
  typeof getUserOrganizationsAction
>['member'][number]['id'] = 'org';
// @ts-expect-error Admin inbox requests retain requester identity.
const wrongRequester: Data<
  typeof getPendingRequestsAction
>['requests'][number]['requester']['id'] = OrganizationId.parse('org');
// @ts-expect-error Organization inbox requests retain requester identity.
const wrongOrgRequester: Data<
  typeof getOrganizationPendingRequestsAction
>['requests'][number]['userId'] = OrganizationId.parse('org');
// @ts-expect-error Ancestor-expanded membership lists retain organization identity.
const rawAncestor: Data<typeof getUserMemberOrganizationsAction>[number]['id'] =
  'org';
// @ts-expect-error Superadmin organization search retains count units.
const rawAdminCount: Data<typeof searchAllOrganizationsAction>['totalCount'] =
  -1;
// @ts-expect-error Join-parent candidates are validated organization references.
const rawCandidate: Data<
  typeof searchOrganizationsForJoinParentAction
>[number]['id'] = 'org';
// @ts-expect-error Filter suggestions decode their raw persistence identities.
const rawSuggestion: Data<
  typeof searchOrganizationsForFilterAction
>[number]['id'] = 'org';
// @ts-expect-error Property lookups are distinct from organization references.
const wrongProperty: Data<typeof getOrgPropertiesAction>[number]['id'] =
  OrganizationId.parse('org');
// @ts-expect-error Grouped property lookups retain validated organization identities.
const rawPropertyOrg: Data<
  typeof getOrgPropertiesTreeAction
>['descendantGroups'][number]['orgId'] = 'org';
// @ts-expect-error Invite candidates retain user identity.
const wrongInviteCandidate: Data<
  typeof searchUsersForMemberInviteAction
>[number]['id'] = OrganizationId.parse('org');

type Details = Extract<
  Awaited<ReturnType<typeof getOrganizationDetailsAction>>,
  { success: true }
>['data'];
// @ts-expect-error Directory organizations cannot be confused with users.
const wrongOrganization: Details['organization']['id'] = UserId.parse('user');
// @ts-expect-error Descendants preserve the same validated identity contract as the root.
const rawDescendant: Details['hierarchyTree']['children'][number]['id'] = 'org';
// @ts-expect-error Descendant counts are nonnegative validated member counts.
const rawCount: Details['hierarchyTree']['children'][number]['memberCount'] =
  -1;
// @ts-expect-error Directory boards are not organization references.
const wrongBoard: Details['boards'][number]['id'] = OrganizationId.parse('org');
