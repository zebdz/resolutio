import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PrismaOrganizationRepository } from '../PrismaOrganizationRepository';
import { Organization } from '../../../domain/organization/Organization';

// Helper: create a mock PrismaClient
function createMockPrisma() {
  return {
    organization: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    organizationUser: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    organizationAdminUser: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

// Helper: standard org DB row
function makeOrgRow(
  overrides: Partial<{
    id: string;
    name: string;
    description: string;
    parentId: string | null;
    createdById: string;
    createdAt: Date;
    archivedAt: Date | null;
  }> = {}
) {
  return {
    id: overrides.id ?? 'org-1',
    name: overrides.name ?? 'Test Org',
    description: overrides.description ?? 'desc',
    parentId: overrides.parentId ?? null,
    createdById: overrides.createdById ?? 'user-1',
    createdAt: overrides.createdAt ?? new Date('2024-01-01'),
    archivedAt: overrides.archivedAt ?? null,
  };
}

describe('PrismaOrganizationRepository', () => {
  let mockPrisma: MockPrisma;
  let repo: PrismaOrganizationRepository;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    // Cast mock to PrismaClient -- repo only uses the subset we mock
    repo = new PrismaOrganizationRepository(mockPrisma as any);
  });

  // ─── getAncestorIds ──────────────────────────────────────────────

  describe('getAncestorIds', () => {
    it('returns empty array for root org (no parent)', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        parentId: null,
      });

      const result = await repo.getAncestorIds('root-org');

      expect(result).toEqual([]);
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'root-org' },
        select: { parentId: true },
      });
    });

    it('returns single parent for one-level hierarchy', async () => {
      // child -> parent (root)
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce({ parentId: 'parent-1' }) // child lookup
        .mockResolvedValueOnce({ parentId: null }); // parent lookup (root)

      const result = await repo.getAncestorIds('child-1');

      expect(result).toEqual(['parent-1']);
    });

    it('returns full chain for multi-level hierarchy', async () => {
      // grandchild -> child -> parent -> root
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce({ parentId: 'child-1' }) // grandchild lookup
        .mockResolvedValueOnce({ parentId: 'parent-1' }) // child lookup
        .mockResolvedValueOnce({ parentId: null }); // parent lookup (root)

      const result = await repo.getAncestorIds('grandchild-1');

      expect(result).toEqual(['child-1', 'parent-1']);
    });

    it('returns empty when org not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce(null);

      const result = await repo.getAncestorIds('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ─── getDescendantIds ────────────────────────────────────────────

  describe('getDescendantIds', () => {
    it('returns empty array when no children', async () => {
      mockPrisma.organization.findMany.mockResolvedValueOnce([]);

      const result = await repo.getDescendantIds('org-1');

      expect(result).toEqual([]);
      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
        where: { parentId: 'org-1' },
        select: { id: true },
      });
    });

    it('returns single child', async () => {
      mockPrisma.organization.findMany
        .mockResolvedValueOnce([{ id: 'child-1' }]) // children of org-1
        .mockResolvedValueOnce([]); // children of child-1

      const result = await repo.getDescendantIds('org-1');

      expect(result).toEqual(['child-1']);
    });

    it('returns multi-level descendants via BFS', async () => {
      // org-1 -> [child-1, child-2]
      // child-1 -> [grandchild-1]
      // child-2 -> []
      // grandchild-1 -> []
      mockPrisma.organization.findMany
        .mockResolvedValueOnce([{ id: 'child-1' }, { id: 'child-2' }]) // children of org-1
        .mockResolvedValueOnce([{ id: 'grandchild-1' }]) // children of child-1
        .mockResolvedValueOnce([]) // children of child-2
        .mockResolvedValueOnce([]); // children of grandchild-1

      const result = await repo.getDescendantIds('org-1');

      expect(result).toEqual(['child-1', 'child-2', 'grandchild-1']);
    });
  });

  // ─── isUserMember ────────────────────────────────────────────────

  describe('isUserMember', () => {
    it('returns true when user is direct member', async () => {
      // getDescendantIds: no children
      mockPrisma.organization.findMany.mockResolvedValueOnce([]);
      // membership found
      mockPrisma.organizationUser.findFirst.mockResolvedValueOnce({
        userId: 'user-1',
        organizationId: 'org-1',
        status: 'accepted',
      });

      const result = await repo.isUserMember('user-1', 'org-1');

      expect(result).toBe(true);
      expect(mockPrisma.organizationUser.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: { in: ['org-1'] },
          status: 'accepted',
        },
      });
    });

    it('returns true when user is member of a descendant', async () => {
      // getDescendantIds: org-1 -> [child-1]
      mockPrisma.organization.findMany
        .mockResolvedValueOnce([{ id: 'child-1' }])
        .mockResolvedValueOnce([]);
      // membership found in child
      mockPrisma.organizationUser.findFirst.mockResolvedValueOnce({
        userId: 'user-1',
        organizationId: 'child-1',
        status: 'accepted',
      });

      const result = await repo.isUserMember('user-1', 'org-1');

      expect(result).toBe(true);
      expect(mockPrisma.organizationUser.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: { in: ['org-1', 'child-1'] },
          status: 'accepted',
        },
      });
    });

    it('returns false when user is not a member', async () => {
      mockPrisma.organization.findMany.mockResolvedValueOnce([]);
      mockPrisma.organizationUser.findFirst.mockResolvedValueOnce(null);

      const result = await repo.isUserMember('user-1', 'org-1');

      expect(result).toBe(false);
    });
  });

  // ─── findAcceptedMemberUserIdsIncludingDescendants ───────────────

  describe('findAcceptedMemberUserIdsIncludingDescendants', () => {
    it('returns member IDs from parent + child', async () => {
      // descendants: org-1 -> [child-1]
      mockPrisma.organization.findMany
        .mockResolvedValueOnce([{ id: 'child-1' }])
        .mockResolvedValueOnce([]);
      // members across both orgs
      mockPrisma.organizationUser.findMany.mockResolvedValueOnce([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      const result =
        await repo.findAcceptedMemberUserIdsIncludingDescendants('org-1');

      expect(result).toEqual(['user-1', 'user-2']);
      expect(mockPrisma.organizationUser.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: { in: ['org-1', 'child-1'] },
          status: 'accepted',
        },
        select: { userId: true },
      });
    });

    it('deduplicates user IDs across orgs', async () => {
      // no descendants
      mockPrisma.organization.findMany
        .mockResolvedValueOnce([{ id: 'child-1' }])
        .mockResolvedValueOnce([]);
      // same user in both orgs
      mockPrisma.organizationUser.findMany.mockResolvedValueOnce([
        { userId: 'user-1' },
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      const result =
        await repo.findAcceptedMemberUserIdsIncludingDescendants('org-1');

      expect(result).toEqual(['user-1', 'user-2']);
    });

    it('returns empty when no members', async () => {
      mockPrisma.organization.findMany.mockResolvedValueOnce([]);
      mockPrisma.organizationUser.findMany.mockResolvedValueOnce([]);

      const result =
        await repo.findAcceptedMemberUserIdsIncludingDescendants('org-1');

      expect(result).toEqual([]);
    });
  });

  // ─── removeUserFromOrganization ──────────────────────────────────

  describe('removeUserFromOrganization', () => {
    it('deletes the OrganizationUser row', async () => {
      mockPrisma.organizationUser.delete.mockResolvedValueOnce({});

      await repo.removeUserFromOrganization('user-1', 'org-1');

      expect(mockPrisma.organizationUser.delete).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: 'org-1',
            userId: 'user-1',
          },
        },
      });
    });
  });

  // ─── findPendingRequestsByUserId ─────────────────────────────────

  describe('findPendingRequestsByUserId', () => {
    it('returns orgs where user has pending status', async () => {
      const orgRow = makeOrgRow({ id: 'org-1', name: 'Pending Org' });
      mockPrisma.organizationUser.findMany.mockResolvedValueOnce([
        { organization: orgRow },
      ]);

      const result = await repo.findPendingRequestsByUserId('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Organization);
      expect(result[0].id).toBe('org-1');
      expect(result[0].name).toBe('Pending Org');
      expect(mockPrisma.organizationUser.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'pending' },
        include: { organization: true },
      });
    });

    it('returns empty array when no pending requests', async () => {
      mockPrisma.organizationUser.findMany.mockResolvedValueOnce([]);

      const result = await repo.findPendingRequestsByUserId('user-1');

      expect(result).toEqual([]);
    });
  });

  // ─── save ────────────────────────────────────────────────────────

  describe('save', () => {
    it('creates org + admin relationship, returns reconstituted Organization', async () => {
      const input = Organization.create('New Org', 'Description', 'user-1');

      if (!input.success) {
        throw new Error('create failed');
      }

      const org = input.value;

      const createdRow = makeOrgRow({
        id: 'created-id',
        name: 'New Org',
        description: 'Description',
        createdById: 'user-1',
      });

      mockPrisma.organization.create.mockResolvedValueOnce(createdRow);
      mockPrisma.organizationAdminUser.create.mockResolvedValueOnce({});

      const result = await repo.save(org);

      expect(result).toBeInstanceOf(Organization);
      expect(result.id).toBe('created-id');
      expect(result.name).toBe('New Org');

      // Verify admin was created
      expect(mockPrisma.organizationAdminUser.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'created-id',
          userId: 'user-1',
        },
      });
    });
  });

  // ─── findById ────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns reconstituted Organization when found', async () => {
      const orgRow = makeOrgRow({ id: 'org-1' });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(orgRow);

      const result = await repo.findById('org-1');

      expect(result).toBeInstanceOf(Organization);
      expect(result!.id).toBe('org-1');
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-1' },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ─── findByName ──────────────────────────────────────────────────

  describe('findByName', () => {
    it('returns reconstituted Organization when found', async () => {
      const orgRow = makeOrgRow({ name: 'My Org' });
      mockPrisma.organization.findUnique.mockResolvedValueOnce(orgRow);

      const result = await repo.findByName('My Org');

      expect(result).toBeInstanceOf(Organization);
      expect(result!.name).toBe('My Org');
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { name: 'My Org' },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce(null);

      const result = await repo.findByName('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ─── findAllWithStats ────────────────────────────────────────────

  describe('findAllWithStats', () => {
    it('returns orgs with member count and first admin', async () => {
      mockPrisma.organization.findMany.mockResolvedValueOnce([
        {
          ...makeOrgRow({ id: 'org-1' }),
          _count: { members: 5 },
          admins: [
            {
              user: { id: 'admin-1', firstName: 'John', lastName: 'Doe' },
            },
          ],
        },
      ]);

      const result = await repo.findAllWithStats();

      expect(result).toHaveLength(1);
      expect(result[0].organization).toBeInstanceOf(Organization);
      expect(result[0].organization.id).toBe('org-1');
      expect(result[0].memberCount).toBe(5);
      expect(result[0].firstAdmin).toEqual({
        id: 'admin-1',
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('returns null firstAdmin when no admins', async () => {
      mockPrisma.organization.findMany.mockResolvedValueOnce([
        {
          ...makeOrgRow({ id: 'org-2' }),
          _count: { members: 0 },
          admins: [],
        },
      ]);

      const result = await repo.findAllWithStats();

      expect(result).toHaveLength(1);
      expect(result[0].firstAdmin).toBeNull();
      expect(result[0].memberCount).toBe(0);
    });

    it('applies exclusion filter when userId provided', async () => {
      mockPrisma.organization.findMany.mockResolvedValueOnce([]);

      await repo.findAllWithStats('user-exclude');

      const callArgs = mockPrisma.organization.findMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({
        archivedAt: null,
        NOT: {
          members: {
            some: {
              userId: 'user-exclude',
              status: { in: ['pending', 'accepted'] },
            },
          },
        },
      });
    });

    it('does not apply exclusion filter when no userId', async () => {
      mockPrisma.organization.findMany.mockResolvedValueOnce([]);

      await repo.findAllWithStats();

      const callArgs = mockPrisma.organization.findMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({ archivedAt: null });
      expect(callArgs.where.NOT).toBeUndefined();
    });
  });

  // ─── findByCreatorId ─────────────────────────────────────────────

  describe('findByCreatorId', () => {
    it('returns reconstituted organizations', async () => {
      mockPrisma.organization.findMany.mockResolvedValueOnce([
        makeOrgRow({ id: 'org-1', createdById: 'user-1' }),
        makeOrgRow({ id: 'org-2', createdById: 'user-1' }),
      ]);

      const result = await repo.findByCreatorId('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Organization);
      expect(result[1]).toBeInstanceOf(Organization);
    });
  });

  // ─── findByParentId ──────────────────────────────────────────────

  describe('findByParentId', () => {
    it('returns child organizations', async () => {
      mockPrisma.organization.findMany.mockResolvedValueOnce([
        makeOrgRow({ id: 'child-1', parentId: 'parent-1' }),
      ]);

      const result = await repo.findByParentId('parent-1');

      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBe('parent-1');
    });
  });

  // ─── isUserAdmin ─────────────────────────────────────────────────

  describe('isUserAdmin', () => {
    it('returns true when admin record exists', async () => {
      mockPrisma.organizationAdminUser.findUnique.mockResolvedValueOnce({
        organizationId: 'org-1',
        userId: 'user-1',
      });

      const result = await repo.isUserAdmin('user-1', 'org-1');

      expect(result).toBe(true);
      expect(mockPrisma.organizationAdminUser.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: 'org-1',
            userId: 'user-1',
          },
        },
      });
    });

    it('returns false when no admin record', async () => {
      mockPrisma.organizationAdminUser.findUnique.mockResolvedValueOnce(null);

      const result = await repo.isUserAdmin('user-1', 'org-1');

      expect(result).toBe(false);
    });
  });

  // ─── findMembershipsByUserId ─────────────────────────────────────

  describe('findMembershipsByUserId', () => {
    it('returns organizations user is accepted member of', async () => {
      const orgRow = makeOrgRow({ id: 'org-1' });
      mockPrisma.organizationUser.findMany.mockResolvedValueOnce([
        { organization: orgRow },
      ]);

      const result = await repo.findMembershipsByUserId('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Organization);
      expect(result[0].id).toBe('org-1');
      expect(mockPrisma.organizationUser.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'accepted' },
        include: { organization: true },
      });
    });
  });

  // ─── findAdminOrganizationsByUserId ──────────────────────────────

  describe('findAdminOrganizationsByUserId', () => {
    it('returns organizations user is admin of', async () => {
      const orgRow = makeOrgRow({ id: 'org-1' });
      mockPrisma.organizationAdminUser.findMany.mockResolvedValueOnce([
        { organization: orgRow },
      ]);

      const result = await repo.findAdminOrganizationsByUserId('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Organization);
      expect(mockPrisma.organizationAdminUser.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { organization: true },
      });
    });
  });

  // ─── update ──────────────────────────────────────────────────────

  describe('update', () => {
    it('updates and returns reconstituted Organization', async () => {
      const org = Organization.reconstitute(
        makeOrgRow({ id: 'org-1', name: 'Updated Org' })
      );

      const updatedRow = makeOrgRow({ id: 'org-1', name: 'Updated Org' });
      mockPrisma.organization.update.mockResolvedValueOnce(updatedRow);

      const result = await repo.update(org);

      expect(result).toBeInstanceOf(Organization);
      expect(result.name).toBe('Updated Org');
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: {
          name: 'Updated Org',
          description: 'desc',
          archivedAt: null,
        },
      });
    });
  });
});
