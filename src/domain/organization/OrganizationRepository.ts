import { Organization } from './Organization';

export interface OrganizationAncestor {
  id: string;
  name: string;
  memberCount: number;
}

export interface OrganizationTreeNode {
  id: string;
  name: string;
  memberCount: number;
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
  findById(id: string): Promise<Organization | null>;

  /**
   * Finds an organization by its name
   */
  findByName(name: string): Promise<Organization | null>;

  /**
   * Finds all organizations where the user is a creator
   */
  findByCreatorId(creatorId: string): Promise<Organization[]>;

  /**
   * Finds all child organizations of a parent organization
   */
  findByParentId(parentId: string): Promise<Organization[]>;

  /**
   * Gets all ancestor organization IDs (parent, grandparent, etc.) for a given organization
   * Used to enforce the rule that a user cannot belong to multiple orgs in the same hierarchy
   */
  getAncestorIds(organizationId: string): Promise<string[]>;

  /**
   * Gets all descendant organization IDs (children, grandchildren, etc.) for a given organization
   */
  getDescendantIds(organizationId: string): Promise<string[]>;

  /**
   * Checks if a user is a member of an organization (accepted status)
   */
  isUserMember(userId: string, organizationId: string): Promise<boolean>;

  /**
   * Checks if a user is an admin of an organization
   */
  isUserAdmin(userId: string, organizationId: string): Promise<boolean>;

  /**
   * Gets all organizations where user is an accepted member
   */
  findMembershipsByUserId(userId: string): Promise<Organization[]>;

  /**
   * Gets all organizations where user is an admin
   */
  findAdminOrganizationsByUserId(userId: string): Promise<Organization[]>;

  /**
   * Gets all organizations available to join (with member count and first admin)
   * @param excludeUserMemberships - Optional userId to exclude organizations where user is already member or has pending request
   */
  findAllWithStats(excludeUserMemberships?: string): Promise<
    Array<{
      organization: Organization;
      memberCount: number;
      firstAdmin: { id: string; firstName: string; lastName: string } | null;
      parentOrg: { id: string; name: string } | null;
    }>
  >;

  /**
   * Updates an existing organization
   */
  update(organization: Organization): Promise<Organization>;

  /**
   * Gets all accepted member user IDs for an organization and all its descendants.
   * Used for org-wide poll snapshots. Returns deduplicated user IDs.
   */
  findAcceptedMemberUserIdsIncludingDescendants(
    organizationId: string
  ): Promise<string[]>;

  /**
   * Removes a user's membership from an organization (deletes OrganizationUser row)
   */
  removeUserFromOrganization(
    userId: string,
    organizationId: string
  ): Promise<void>;

  /**
   * Finds organizations where user has a pending join request
   */
  findPendingRequestsByUserId(userId: string): Promise<Organization[]>;

  /**
   * Gets ancestors with name + member count, ordered [parent, grandparent, ...]
   */
  getAncestors(organizationId: string): Promise<OrganizationAncestor[]>;

  /**
   * Gets direct children with name + member count (excludes archived)
   */
  getChildrenWithStats(organizationId: string): Promise<OrganizationAncestor[]>;

  /**
   * Gets full hierarchy tree: ancestors list + recursive subtree from root.
   * Excludes archived orgs. Max recursion depth: 100.
   */
  getHierarchyTree(organizationId: string): Promise<{
    ancestors: OrganizationAncestor[];
    tree: OrganizationTreeNode;
  }>;
}
