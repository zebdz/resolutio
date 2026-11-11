/** Organization persistence/query port carries validated identities and names.
 * Query text stays plain; pagination inputs and result totals use distinct units. */
import { FirstName, LastName, MiddleName } from '../user/UserValues';
import { OrganizationId, UserId } from '../shared/EntityIds';
import {
  PageNumber,
  PageSize,
  ResultCount,
  ResultLimit,
} from '../shared/Pagination';
import {
  OrganizationName,
  MemberRemovalReason,
  MemberCount,
} from './OrganizationValues';
import { Organization } from './Organization';

export interface OrganizationSearchFilters {
  search?: string;
  page?: PageNumber;
  pageSize?: PageSize;
  includeArchived?: boolean;
}

export interface OrganizationWithStats {
  organization: Organization;
  memberCount: MemberCount;
  firstAdmin: {
    id: UserId;
    firstName: FirstName;
    lastName: LastName;
    middleName: MiddleName | null;
  } | null;
  parentOrg: { id: OrganizationId; name: OrganizationName } | null;
}

export interface OrganizationAncestor {
  id: OrganizationId;
  name: OrganizationName;
  memberCount: MemberCount;
}

export interface OrganizationTreeNode {
  id: OrganizationId;
  name: OrganizationName;
  memberCount: MemberCount;
  children: OrganizationTreeNode[];
}

export interface OrganizationRepository {
  /**
   * Saves a new organization to the database
   */
  save(organization: Organization): Promise<Organization>;

  /**
   * Finds an organization by its ID
   */
  findById(id: OrganizationId): Promise<Organization | null>;

  /**
   * Finds an organization by its name
   */
  findByName(name: OrganizationName): Promise<Organization | null>;

  /**
   * Finds all organizations where the user is a creator
   */
  findByCreatorId(creatorId: UserId): Promise<Organization[]>;

  /**
   * Finds all child organizations of a parent organization
   */
  findByParentId(parentId: OrganizationId): Promise<Organization[]>;

  /**
   * Gets all ancestor organization IDs (parent, grandparent, etc.) for a given organization
   * Used to enforce the rule that a user cannot belong to multiple orgs in the same hierarchy
   */
  getAncestorIds(organizationId: OrganizationId): Promise<OrganizationId[]>;

  /**
   * Gets all descendant organization IDs (children, grandchildren, etc.) for a given organization
   */
  getDescendantIds(organizationId: OrganizationId): Promise<OrganizationId[]>;

  /**
   * Gets all organization IDs in the same hierarchy tree (root + all descendants),
   * excluding the given organization. Used to enforce single-membership-per-tree rule.
   */
  getFullTreeOrgIds(organizationId: OrganizationId): Promise<OrganizationId[]>;

  /**
   * Checks if a user is a member of an organization (accepted status)
   */
  isUserMember(
    userId: UserId,
    organizationId: OrganizationId
  ): Promise<boolean>;

  /**
   * Exact membership check — does NOT walk descendant orgs. Used by the
   * report visibility service for the WITHIN_ORG_ONLY rule, where
   * "member of orgX" must not silently include members of orgX's
   * descendant orgs.
   */
  isUserExactMember(
    userId: UserId,
    organizationId: OrganizationId
  ): Promise<boolean>;

  /**
   * Checks if a user is an admin of an organization
   */
  isUserAdmin(userId: UserId, organizationId: OrganizationId): Promise<boolean>;

  /**
   * Ids of every admin of an organization, for notifying the people who can
   * act on something addressed to "the admins".
   */
  getAdminUserIds(organizationId: OrganizationId): Promise<UserId[]>;

  /**
   * Gets all organizations where user is an accepted member
   */
  findMembershipsByUserId(userId: UserId): Promise<Organization[]>;

  /**
   * Gets all organizations where user is an admin
   */
  findAdminOrganizationsByUserId(userId: UserId): Promise<Organization[]>;

  /**
   * Gets all organizations available to join (with member count and first admin)
   * @param excludeUserMemberships - Optional userId to exclude organizations where user is already member or has pending request
   */
  findAllWithStats(
    excludeUserMemberships?: UserId
  ): Promise<OrganizationWithStats[]>;

  /**
   * Paginated search for organizations with stats.
   * Searches name, description, and parent org name (case-insensitive).
   */
  searchOrganizationsWithStats(
    filters: OrganizationSearchFilters,
    excludeUserMemberships?: UserId
  ): Promise<{
    organizations: OrganizationWithStats[];
    totalCount: ResultCount;
  }>;

  /**
   * Updates an existing organization
   */
  update(organization: Organization): Promise<Organization>;

  /**
   * Gets all accepted member user IDs for an organization and all its descendants.
   * Used for org-wide poll snapshots. Returns deduplicated user IDs.
   */
  findAcceptedMemberUserIdsIncludingDescendants(
    organizationId: OrganizationId
  ): Promise<UserId[]>;

  /**
   * Returns deduplicated user IDs of accepted members across the EXACT
   * org IDs given (no hierarchy walk). Used by NotifyReportPublishedUseCase
   * to fan out notifications to a precise audience set.
   */
  findAcceptedMemberUserIdsForOrgs(orgIds: OrganizationId[]): Promise<UserId[]>;

  /**
   * Removes a user's membership from an organization (deletes OrganizationUser row)
   */
  removeUserFromOrganization(
    userId: UserId,
    organizationId: OrganizationId
  ): Promise<void>;

  /**
   * Superadmin/admin removal of a member: hard-deletes the OrganizationUser
   * row and writes an OrganizationMemberRemoval audit row, in one transaction.
   */
  removeMemberFromOrganization(
    organizationId: OrganizationId,
    userId: UserId,
    removedByUserId: UserId,
    reason: MemberRemovalReason
  ): Promise<void>;

  /**
   * Finds organizations where user has a pending join request
   */
  findPendingRequestsByUserId(userId: UserId): Promise<Organization[]>;

  /**
   * Gets ancestors with name + member count, ordered [parent, grandparent, ...]
   */
  getAncestors(organizationId: OrganizationId): Promise<OrganizationAncestor[]>;

  /**
   * Gets direct children with name + member count (excludes archived)
   */
  getChildrenWithStats(
    organizationId: OrganizationId
  ): Promise<OrganizationAncestor[]>;

  /**
   * Gets full hierarchy tree: ancestors list + recursive subtree from root.
   * Excludes archived orgs. Max recursion depth: 100.
   */
  getHierarchyTree(organizationId: OrganizationId): Promise<{
    ancestors: OrganizationAncestor[];
    tree: OrganizationTreeNode;
  }>;

  /**
   * Gets all admin user IDs for an organization
   */
  findAdminUserIds(organizationId: OrganizationId): Promise<UserId[]>;

  /**
   * Sets the parentId of an organization (used for join parent request acceptance)
   */
  setParentId(
    organizationId: OrganizationId,
    parentId: OrganizationId | null
  ): Promise<void>;

  /**
   * Fuzzy (subsequence) search for organizations by name.
   * Query "abc" matches names containing a...b...c in order.
   * Excludes archived orgs and orgs in excludeIds.
   */
  searchByNameFuzzy(
    query: string,
    excludeIds: OrganizationId[],
    limit: ResultLimit
  ): Promise<Array<{ id: OrganizationId; name: OrganizationName }>>;

  /**
   * Adds a user as an admin of an organization
   */
  addAdmin(organizationId: OrganizationId, userId: UserId): Promise<void>;

  /**
   * Removes a user as admin of an organization.
   * Must guarantee at least 1 admin remains (transactional).
   * Throws if this is the last admin.
   */
  removeAdmin(organizationId: OrganizationId, userId: UserId): Promise<void>;

  /**
   * Walks up the hierarchy to the root org and returns its allowMultiTreeMembership value.
   * Returns false if root's value is NULL (data corruption fallback).
   */
  getRootAllowMultiTreeMembership(
    organizationId: OrganizationId
  ): Promise<boolean>;

  /**
   * Returns userIds that hold accepted memberships in 2+ of the given org IDs.
   * Includes memberships in archived orgs.
   */
  findUsersWithMultipleMembershipsInOrgs(
    orgIds: OrganizationId[]
  ): Promise<UserId[]>;

  /**
   * Updates the allowMultiTreeMembership setting for an organization.
   */
  setAllowMultiTreeMembership(
    organizationId: OrganizationId,
    value: boolean | null
  ): Promise<void>;
}
