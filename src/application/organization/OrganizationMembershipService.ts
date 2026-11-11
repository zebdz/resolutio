/** Application coordinator gathers membership facts and invokes the pure tree policy.
 * Repository reads/removals stay outside the domain while preserving existing sequencing. */
import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { membershipsToLeave } from '../../domain/organization/MembershipPolicy';

export class OrganizationMembershipService {
  /**
   * Removes user from all organizations in the hierarchy tree
   * (ancestors + descendants) except the target organization.
   * Used when user joins/is invited to an org to enforce single-membership-per-tree rule.
   */
  static async removeUserFromHierarchyOrgs(
    userId: UserId,
    organizationId: OrganizationId,
    organizationRepository: Pick<
      OrganizationRepository,
      | 'getFullTreeOrgIds'
      | 'findMembershipsByUserId'
      | 'removeUserFromOrganization'
    >
  ): Promise<void> {
    const hierarchyOrgIds =
      await organizationRepository.getFullTreeOrgIds(organizationId);

    const userMemberships =
      await organizationRepository.findMembershipsByUserId(userId);

    const previousMembershipIds = membershipsToLeave(
      organizationId,
      hierarchyOrgIds,
      userMemberships.map((membership) => membership.id)
    );

    for (const membershipId of previousMembershipIds) {
      await organizationRepository.removeUserFromOrganization(
        userId,
        membershipId
      );
    }
  }

  /**
   * Returns userIds that hold accepted memberships in 2+ orgs within the tree
   * rooted at rootOrgId (including archived orgs).
   */
  static async findUsersWithMultipleTreeMemberships(
    rootOrgId: OrganizationId,
    organizationRepository: Pick<
      OrganizationRepository,
      'getDescendantIds' | 'findUsersWithMultipleMembershipsInOrgs'
    >
  ): Promise<UserId[]> {
    const descendantIds =
      await organizationRepository.getDescendantIds(rootOrgId);
    const allTreeOrgIds = [rootOrgId, ...descendantIds];

    return organizationRepository.findUsersWithMultipleMembershipsInOrgs(
      allTreeOrgIds
    );
  }
}
