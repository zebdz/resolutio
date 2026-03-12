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
}
