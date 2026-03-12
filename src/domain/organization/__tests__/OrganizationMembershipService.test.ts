import { describe, it, expect, vi } from 'vitest';
import { OrganizationMembershipService } from '../OrganizationMembershipService';
import { OrganizationRepository } from '../OrganizationRepository';
import { Organization } from '../Organization';

function makeOrg(id: string): Organization {
  return Organization.reconstitute({
    id,
    name: `Org ${id}`,
    description: 'Test',
    parentId: null,
    createdById: 'user-1',
    createdAt: new Date(),
    archivedAt: null,
  });
}

function makeMockOrgRepo(
  overrides?: Partial<OrganizationRepository>
): OrganizationRepository {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    findByCreatorId: vi.fn(),
    findByParentId: vi.fn(),
    getAncestorIds: vi.fn(),
    getDescendantIds: vi.fn(),
    getFullTreeOrgIds: vi.fn().mockResolvedValue([]),
    isUserMember: vi.fn(),
    isUserAdmin: vi.fn(),
    findMembershipsByUserId: vi.fn().mockResolvedValue([]),
    findAdminOrganizationsByUserId: vi.fn(),
    findAllWithStats: vi.fn(),
    searchOrganizationsWithStats: vi.fn(),
    update: vi.fn(),
    findAcceptedMemberUserIdsIncludingDescendants: vi.fn(),
    removeUserFromOrganization: vi.fn(),
    findPendingRequestsByUserId: vi.fn(),
    getAncestors: vi.fn(),
    getChildrenWithStats: vi.fn(),
    getHierarchyTree: vi.fn(),
    findAdminUserIds: vi.fn(),
    setParentId: vi.fn(),
    addAdmin: vi.fn(),
    removeAdmin: vi.fn(),
    ...overrides,
  } as OrganizationRepository;
}

describe('OrganizationMembershipService.removeUserFromHierarchyOrgs', () => {
  it('should remove user from orgs in the hierarchy tree', async () => {
    const removeFromOrg = vi.fn();
    const repo = makeMockOrgRepo({
      getFullTreeOrgIds: vi.fn().mockResolvedValue(['org-a', 'org-b', 'org-c']),
      findMembershipsByUserId: vi
        .fn()
        .mockResolvedValue([makeOrg('org-a'), makeOrg('org-b')]),
      removeUserFromOrganization: removeFromOrg,
    });

    await OrganizationMembershipService.removeUserFromHierarchyOrgs(
      'user-1',
      'org-target',
      repo
    );

    expect(removeFromOrg).toHaveBeenCalledTimes(2);
    expect(removeFromOrg).toHaveBeenCalledWith('user-1', 'org-a');
    expect(removeFromOrg).toHaveBeenCalledWith('user-1', 'org-b');
  });

  it('should not remove user from orgs outside the hierarchy', async () => {
    const removeFromOrg = vi.fn();
    const repo = makeMockOrgRepo({
      getFullTreeOrgIds: vi.fn().mockResolvedValue(['org-a', 'org-b']),
      findMembershipsByUserId: vi
        .fn()
        .mockResolvedValue([makeOrg('org-x'), makeOrg('org-y')]),
      removeUserFromOrganization: removeFromOrg,
    });

    await OrganizationMembershipService.removeUserFromHierarchyOrgs(
      'user-1',
      'org-target',
      repo
    );

    expect(removeFromOrg).not.toHaveBeenCalled();
  });

  it('should do nothing when user has no memberships', async () => {
    const removeFromOrg = vi.fn();
    const repo = makeMockOrgRepo({
      getFullTreeOrgIds: vi.fn().mockResolvedValue(['org-a']),
      findMembershipsByUserId: vi.fn().mockResolvedValue([]),
      removeUserFromOrganization: removeFromOrg,
    });

    await OrganizationMembershipService.removeUserFromHierarchyOrgs(
      'user-1',
      'org-target',
      repo
    );

    expect(removeFromOrg).not.toHaveBeenCalled();
  });
});
