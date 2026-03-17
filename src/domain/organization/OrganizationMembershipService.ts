import { OrganizationRepository } from './OrganizationRepository';

export class OrganizationMembershipService {
  /**
   * Removes user from all organizations in the hierarchy tree
   * (ancestors + descendants) except the target organization.
   * Used when user joins/is invited to an org to enforce single-membership-per-tree rule.
   */
  static async removeUserFromHierarchyOrgs(
    userId: string,
    organizationId: string,
    organizationRepository: OrganizationRepository
  ): Promise<void> {
    const hierarchyOrgIds =
      await organizationRepository.getFullTreeOrgIds(organizationId);

    const userMemberships =
      await organizationRepository.findMembershipsByUserId(userId);

    for (const membership of userMemberships) {
      if (hierarchyOrgIds.includes(membership.id)) {
        await organizationRepository.removeUserFromOrganization(
          userId,
          membership.id
        );
      }
    }
  }

  /**
   * Returns userIds that hold accepted memberships in 2+ orgs within the tree
   * rooted at rootOrgId (including archived orgs).
   */
  static async findUsersWithMultipleTreeMemberships(
    rootOrgId: string,
    organizationRepository: OrganizationRepository
  ): Promise<string[]> {
    const descendantIds =
      await organizationRepository.getDescendantIds(rootOrgId);
    const allTreeOrgIds = [rootOrgId, ...descendantIds];

    return organizationRepository.findUsersWithMultipleMembershipsInOrgs(
      allTreeOrgIds
    );
  }
}
