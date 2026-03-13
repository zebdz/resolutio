import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GetOrgAdminsPaginatedUseCase,
  GetOrgAdminsPaginatedDependencies,
} from '../GetOrgAdminsPaginatedUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';

class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminRoles: Map<string, Set<string>> = new Map();
  private memberRoles: Map<string, Set<string>> = new Map();

  async save(org: Organization): Promise<Organization> {
    this.organizations.set(org.id, org);

    return org;
  }
  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }
  async findByName(): Promise<Organization | null> {
    return null;
  }
  async findByCreatorId(): Promise<Organization[]> {
    return [];
  }
  async findByParentId(): Promise<Organization[]> {
    return [];
  }
  async getAncestorIds(): Promise<string[]> {
    return [];
  }
  async getDescendantIds(): Promise<string[]> {
    return [];
  }
  async getFullTreeOrgIds(): Promise<string[]> {
    return [];
  }
  async isUserMember(userId: string, organizationId: string): Promise<boolean> {
    const members = this.memberRoles.get(organizationId);

    return members ? members.has(userId) : false;
  }
  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    const admins = this.adminRoles.get(organizationId);

    return admins ? admins.has(userId) : false;
  }
  async findMembershipsByUserId(): Promise<Organization[]> {
    return [];
  }
  async findAdminOrganizationsByUserId(): Promise<Organization[]> {
    return [];
  }
  async findAllWithStats(): Promise<any[]> {
    return [];
  }
  async searchOrganizationsWithStats(): Promise<any> {
    return { organizations: [], totalCount: 0 };
  }
  async update(org: Organization): Promise<Organization> {
    return org;
  }
  async findAcceptedMemberUserIdsIncludingDescendants(): Promise<string[]> {
    return [];
  }
  async removeUserFromOrganization(): Promise<void> {}
  async findPendingRequestsByUserId(): Promise<Organization[]> {
    return [];
  }
  async getAncestors(): Promise<any[]> {
    return [];
  }
  async getChildrenWithStats(): Promise<any[]> {
    return [];
  }
  async getHierarchyTree(): Promise<any> {
    return {
      ancestors: [],
      tree: { id: '', name: '', memberCount: 0, children: [] },
    };
  }
  async findAdminUserIds(): Promise<string[]> {
    return [];
  }
  async setParentId(): Promise<void> {}
  async addAdmin(organizationId: string, userId: string): Promise<void> {
    if (!this.adminRoles.has(organizationId)) {
      this.adminRoles.set(organizationId, new Set());
    }

    this.adminRoles.get(organizationId)!.add(userId);
  }
  async removeAdmin(): Promise<void> {}
  async searchByNameFuzzy(): Promise<Array<{ id: string; name: string }>> {
    return [];
  }

  // Test helpers
  addOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
  }
  setAdmin(organizationId: string, userId: string): void {
    if (!this.adminRoles.has(organizationId)) {
      this.adminRoles.set(organizationId, new Set());
    }

    this.adminRoles.get(organizationId)!.add(userId);
  }
  setMember(organizationId: string, userId: string): void {
    if (!this.memberRoles.has(organizationId)) {
      this.memberRoles.set(organizationId, new Set());
    }

    this.memberRoles.get(organizationId)!.add(userId);
  }
}

class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();

  async findById(): Promise<any> {
    return null;
  }
  async findByIds(): Promise<any[]> {
    return [];
  }
  async findByPhoneNumber(): Promise<any> {
    return null;
  }
  async save(user: any): Promise<any> {
    return user;
  }
  async exists(): Promise<boolean> {
    return false;
  }
  async searchUsers(): Promise<any[]> {
    return [];
  }
  async searchUserByPhone(): Promise<any> {
    return null;
  }
  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }
  async findByNickname(): Promise<any> {
    return null;
  }
  async isNicknameAvailable(): Promise<boolean> {
    return true;
  }
  async updatePrivacySettings(): Promise<void> {}
  async isUserBlocked(): Promise<boolean> {
    return false;
  }
  async blockUser(): Promise<void> {}
  async unblockUser(): Promise<void> {}
  async confirmUser(): Promise<void> {}
  async getBlockStatus(): Promise<null> {
    return null;
  }

  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }
}

function makeOrg(id: string): Organization {
  return Organization.reconstitute({
    id,
    name: 'Test Org',
    description: 'Test',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
  });
}

function makeMockPrisma(rows: any[] = [], count: number = 0) {
  return {
    organizationAdminUser: {
      findMany: vi.fn().mockResolvedValue(rows),
      count: vi.fn().mockResolvedValue(count),
    },
  } as any;
}

function makeAdminRow(
  userId: string,
  firstName: string,
  lastName: string,
  nickname: string,
  middleName: string | null = null,
  createdAt: Date = new Date()
) {
  return {
    createdAt,
    user: { id: userId, firstName, lastName, middleName, nickname },
  };
}

describe('GetOrgAdminsPaginatedUseCase', () => {
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();
  });

  function createUseCase(prisma: any): GetOrgAdminsPaginatedUseCase {
    const deps: GetOrgAdminsPaginatedDependencies = {
      prisma,
      organizationRepository: orgRepo,
      userRepository: userRepo,
    };

    return new GetOrgAdminsPaginatedUseCase(deps);
  }

  it('should return paginated admins', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'actor-1');

    const rows = [
      makeAdminRow('admin-1', 'Alice', 'Smith', 'asmith'),
      makeAdminRow('admin-2', 'Bob', 'Jones', 'bjones'),
    ];
    const mockPrisma = makeMockPrisma(rows, 2);
    const useCase = createUseCase(mockPrisma);

    const result = await useCase.execute({
      organizationId: 'org-1',
      actorUserId: 'actor-1',
      page: 1,
      pageSize: 20,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.admins).toHaveLength(2);
      expect(result.value.totalCount).toBe(2);
      expect(result.value.admins[0]).toMatchObject({
        id: 'admin-1',
        firstName: 'Alice',
        lastName: 'Smith',
        nickname: 'asmith',
      });
    }

    expect(mockPrisma.organizationAdminUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
      })
    );
  });

  it('should filter by query (case insensitive)', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'actor-1');

    const mockPrisma = makeMockPrisma([], 0);
    const useCase = createUseCase(mockPrisma);

    await useCase.execute({
      organizationId: 'org-1',
      actorUserId: 'actor-1',
      page: 1,
      pageSize: 20,
      query: 'alice',
    });

    const findManyCall =
      mockPrisma.organizationAdminUser.findMany.mock.calls[0][0];

    expect(findManyCall.where.user).toEqual({
      OR: [
        { firstName: { contains: 'alice', mode: 'insensitive' } },
        { lastName: { contains: 'alice', mode: 'insensitive' } },
        { middleName: { contains: 'alice', mode: 'insensitive' } },
        { nickname: { contains: 'alice', mode: 'insensitive' } },
      ],
    });
  });

  it('should fail when org not found', async () => {
    const mockPrisma = makeMockPrisma();
    const useCase = createUseCase(mockPrisma);

    const result = await useCase.execute({
      organizationId: 'nonexistent',
      actorUserId: 'actor-1',
      page: 1,
      pageSize: 20,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notFound');
    }
  });

  it('should deny non-admin non-member', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));

    const mockPrisma = makeMockPrisma();
    const useCase = createUseCase(mockPrisma);

    const result = await useCase.execute({
      organizationId: 'org-1',
      actorUserId: 'nobody',
      page: 1,
      pageSize: 20,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notAdmin');
    }
  });

  it('should allow superadmin', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    userRepo.addSuperAdmin('superadmin-1');

    const rows = [makeAdminRow('admin-1', 'Alice', 'Smith', 'asmith')];
    const mockPrisma = makeMockPrisma(rows, 1);
    const useCase = createUseCase(mockPrisma);

    const result = await useCase.execute({
      organizationId: 'org-1',
      actorUserId: 'superadmin-1',
      page: 1,
      pageSize: 20,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.admins).toHaveLength(1);
    }
  });

  it('should allow org member (non-admin)', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setMember('org-1', 'member-1');

    const rows = [makeAdminRow('admin-1', 'Alice', 'Smith', 'asmith')];
    const mockPrisma = makeMockPrisma(rows, 1);
    const useCase = createUseCase(mockPrisma);

    const result = await useCase.execute({
      organizationId: 'org-1',
      actorUserId: 'member-1',
      page: 1,
      pageSize: 20,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.admins).toHaveLength(1);
    }
  });

  it('should calculate correct skip for page 2', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'actor-1');

    const mockPrisma = makeMockPrisma([], 0);
    const useCase = createUseCase(mockPrisma);

    await useCase.execute({
      organizationId: 'org-1',
      actorUserId: 'actor-1',
      page: 2,
      pageSize: 10,
    });

    expect(mockPrisma.organizationAdminUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      })
    );
  });
});
