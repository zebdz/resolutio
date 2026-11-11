/** Membership coordination tests preserve tree scope and repository sequencing.
 * Pure membership selection rules are tested separately in the domain. */
import { UserId, OrganizationId } from '../../../domain/shared/EntityIds';
import { describe, it, expect, vi } from 'vitest';
import { OrganizationMembershipService } from '../OrganizationMembershipService';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { Organization } from '../../../domain/organization/Organization';

function makeOrg(id: string): Organization {
  return Organization.reconstitute({
    id,
    name: `Org ${id}`,
    description: 'Test',
    parentId: null,
    createdById: UserId.parse('user-1'),
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: false,
  });
}

type MembershipPorts = Pick<
  OrganizationRepository,
  | 'getFullTreeOrgIds'
  | 'findMembershipsByUserId'
  | 'removeUserFromOrganization'
  | 'getDescendantIds'
  | 'findUsersWithMultipleMembershipsInOrgs'
>;

function makeMockOrgRepo(
  overrides?: Partial<MembershipPorts>
): MembershipPorts {
  return {
    getFullTreeOrgIds: vi.fn().mockResolvedValue([]),
    findMembershipsByUserId: vi.fn().mockResolvedValue([]),
    removeUserFromOrganization: vi.fn(),
    getDescendantIds: vi.fn().mockResolvedValue([]),
    findUsersWithMultipleMembershipsInOrgs: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('OrganizationMembershipService.removeUserFromHierarchyOrgs', () => {
  it('should remove user from orgs in the hierarchy tree', async () => {
    const removeFromOrg = vi.fn();
    const repo = makeMockOrgRepo({
      getFullTreeOrgIds: vi
        .fn()
        .mockResolvedValue([
          OrganizationId.parse('org-a'),
          OrganizationId.parse('org-b'),
          OrganizationId.parse('org-c'),
        ]),
      findMembershipsByUserId: vi
        .fn()
        .mockResolvedValue([
          makeOrg(OrganizationId.parse('org-a')),
          makeOrg(OrganizationId.parse('org-b')),
        ]),
      removeUserFromOrganization: removeFromOrg,
    });

    await OrganizationMembershipService.removeUserFromHierarchyOrgs(
      UserId.parse('user-1'),
      OrganizationId.parse('org-target'),
      repo
    );

    expect(removeFromOrg).toHaveBeenCalledTimes(2);
    expect(removeFromOrg).toHaveBeenCalledWith(
      UserId.parse('user-1'),
      OrganizationId.parse('org-a')
    );
    expect(removeFromOrg).toHaveBeenCalledWith(
      UserId.parse('user-1'),
      OrganizationId.parse('org-b')
    );
  });

  it('should not remove user from orgs outside the hierarchy', async () => {
    const removeFromOrg = vi.fn();
    const repo = makeMockOrgRepo({
      getFullTreeOrgIds: vi
        .fn()
        .mockResolvedValue([
          OrganizationId.parse('org-a'),
          OrganizationId.parse('org-b'),
        ]),
      findMembershipsByUserId: vi
        .fn()
        .mockResolvedValue([
          makeOrg(OrganizationId.parse('org-x')),
          makeOrg(OrganizationId.parse('org-y')),
        ]),
      removeUserFromOrganization: removeFromOrg,
    });

    await OrganizationMembershipService.removeUserFromHierarchyOrgs(
      UserId.parse('user-1'),
      OrganizationId.parse('org-target'),
      repo
    );

    expect(removeFromOrg).not.toHaveBeenCalled();
  });

  it('should do nothing when user has no memberships', async () => {
    const removeFromOrg = vi.fn();
    const repo = makeMockOrgRepo({
      getFullTreeOrgIds: vi
        .fn()
        .mockResolvedValue([OrganizationId.parse('org-a')]),
      findMembershipsByUserId: vi.fn().mockResolvedValue([]),
      removeUserFromOrganization: removeFromOrg,
    });

    await OrganizationMembershipService.removeUserFromHierarchyOrgs(
      UserId.parse('user-1'),
      OrganizationId.parse('org-target'),
      repo
    );

    expect(removeFromOrg).not.toHaveBeenCalled();
  });
});

describe('OrganizationMembershipService.findUsersWithMultipleTreeMemberships', () => {
  it('should return empty array when no users have multiple memberships', async () => {
    const findMultiple = vi.fn().mockResolvedValue([]);
    const repo = makeMockOrgRepo({
      getDescendantIds: vi.fn().mockResolvedValue(['child-1']),
      findUsersWithMultipleMembershipsInOrgs: findMultiple,
    });

    const result =
      await OrganizationMembershipService.findUsersWithMultipleTreeMemberships(
        OrganizationId.parse('root-1'),
        repo
      );

    expect(result).toEqual([]);
    expect(findMultiple).toHaveBeenCalledWith(['root-1', 'child-1']);
  });

  it('should return userIds of users in multiple orgs within the tree', async () => {
    const findMultiple = vi.fn().mockResolvedValue([UserId.parse('user-1')]);
    const repo = makeMockOrgRepo({
      getDescendantIds: vi.fn().mockResolvedValue(['child-1', 'child-2']),
      findUsersWithMultipleMembershipsInOrgs: findMultiple,
    });

    const result =
      await OrganizationMembershipService.findUsersWithMultipleTreeMemberships(
        OrganizationId.parse('root-1'),
        repo
      );

    expect(result).toEqual([UserId.parse('user-1')]);
    expect(findMultiple).toHaveBeenCalledWith(['root-1', 'child-1', 'child-2']);
  });

  it('should include root org in the query', async () => {
    const findMultiple = vi.fn().mockResolvedValue([]);
    const repo = makeMockOrgRepo({
      getDescendantIds: vi.fn().mockResolvedValue([]),
      findUsersWithMultipleMembershipsInOrgs: findMultiple,
    });

    await OrganizationMembershipService.findUsersWithMultipleTreeMemberships(
      OrganizationId.parse('root-1'),
      repo
    );

    expect(findMultiple).toHaveBeenCalledWith(['root-1']);
  });
});
