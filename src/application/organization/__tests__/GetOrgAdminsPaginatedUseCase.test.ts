/** Administrator directory tests preserve access, search and pagination behavior.
 * The real read adapter validates simulated storage projections. */
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaOrganizationDirectory } from '@/infrastructure/repositories/PrismaOrganizationDirectory';
import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import { UserId } from '../../../domain/shared/EntityIds';
import { OrganizationName } from '../../../domain/organization/OrganizationValues';
import { OrganizationId } from '../../../domain/shared/EntityIds';
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

  async save(org: Organization): ReturnType<OrganizationRepository['save']> {
    this.organizations.set(org.id, org);

    return org;
  }
  async findById(id: string): ReturnType<OrganizationRepository['findById']> {
    return this.organizations.get(id) || null;
  }
  async findByName(): ReturnType<OrganizationRepository['findByName']> {
    return null;
  }
  async findByCreatorId(): ReturnType<
    OrganizationRepository['findByCreatorId']
  > {
    return [];
  }
  async findByParentId(): ReturnType<OrganizationRepository['findByParentId']> {
    return [];
  }
  async getAncestorIds(): ReturnType<OrganizationRepository['getAncestorIds']> {
    return OrganizationId.array().parse([]);
  }
  async getDescendantIds(): ReturnType<
    OrganizationRepository['getDescendantIds']
  > {
    return OrganizationId.array().parse([]);
  }
  async getFullTreeOrgIds(): ReturnType<
    OrganizationRepository['getFullTreeOrgIds']
  > {
    return OrganizationId.array().parse([]);
  }
  async isUserMember(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserMember']> {
    const members = this.memberRoles.get(organizationId);

    return members ? members.has(userId) : false;
  }
  async isUserAdmin(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserAdmin']> {
    const admins = this.adminRoles.get(organizationId);

    return admins ? admins.has(userId) : false;
  }
  async findMembershipsByUserId(): ReturnType<
    OrganizationRepository['findMembershipsByUserId']
  > {
    return [];
  }
  async findAdminOrganizationsByUserId(): ReturnType<
    OrganizationRepository['findAdminOrganizationsByUserId']
  > {
    return [];
  }
  async findAllWithStats(): ReturnType<
    OrganizationRepository['findAllWithStats']
  > {
    return [];
  }
  async searchOrganizationsWithStats(): ReturnType<
    OrganizationRepository['searchOrganizationsWithStats']
  > {
    return { organizations: [], totalCount: ResultCount.parse(0) };
  }
  async update(
    org: Organization
  ): ReturnType<OrganizationRepository['update']> {
    return org;
  }
  async findAcceptedMemberUserIdsIncludingDescendants(): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    return UserId.array().parse([]);
  }
  async removeUserFromOrganization(): ReturnType<
    OrganizationRepository['removeUserFromOrganization']
  > {}
  async findPendingRequestsByUserId(): ReturnType<
    OrganizationRepository['findPendingRequestsByUserId']
  > {
    return [];
  }
  async getAncestors(): ReturnType<OrganizationRepository['getAncestors']> {
    return [];
  }
  async getChildrenWithStats(): ReturnType<
    OrganizationRepository['getChildrenWithStats']
  > {
    return [];
  }
  async getHierarchyTree(): ReturnType<
    OrganizationRepository['getHierarchyTree']
  > {
    return {
      ancestors: [],
      tree: {
        id: OrganizationId.parse('org-fixture'),
        name: OrganizationName.parse('Fixture organization'),
        memberCount: MemberCount.parse(0),
        children: [],
      },
    };
  }
  async findAdminUserIds(): ReturnType<
    OrganizationRepository['findAdminUserIds']
  > {
    return UserId.array().parse([]);
  }
  async setParentId(): ReturnType<OrganizationRepository['setParentId']> {}
  async addAdmin(
    organizationId: string,
    userId: string
  ): ReturnType<OrganizationRepository['addAdmin']> {
    if (!this.adminRoles.has(organizationId)) {
      this.adminRoles.set(organizationId, new Set());
    }

    this.adminRoles.get(organizationId)!.add(userId);
  }
  async removeAdmin(): ReturnType<OrganizationRepository['removeAdmin']> {}
  async searchByNameFuzzy(): ReturnType<
    OrganizationRepository['searchByNameFuzzy']
  > {
    return [];
  }
  async getRootAllowMultiTreeMembership(
    _orgId: string
  ): ReturnType<OrganizationRepository['getRootAllowMultiTreeMembership']> {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs(
    _orgIds: string[]
  ): ReturnType<
    OrganizationRepository['findUsersWithMultipleMembershipsInOrgs']
  > {
    return UserId.array().parse([]);
  }
  async setAllowMultiTreeMembership(
    _organizationId: string,
    _value: boolean | null
  ): ReturnType<OrganizationRepository['setAllowMultiTreeMembership']> {}

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

  async isUserExactMember(
    ..._args: Parameters<OrganizationRepository['isUserExactMember']>
  ): ReturnType<OrganizationRepository['isUserExactMember']> {
    throw new Error('Unexpected isUserExactMember in this test');
  }

  async getAdminUserIds(
    ..._args: Parameters<OrganizationRepository['getAdminUserIds']>
  ): ReturnType<OrganizationRepository['getAdminUserIds']> {
    throw new Error('Unexpected getAdminUserIds in this test');
  }

  async findAcceptedMemberUserIdsForOrgs(
    ..._args: Parameters<
      OrganizationRepository['findAcceptedMemberUserIdsForOrgs']
    >
  ): ReturnType<OrganizationRepository['findAcceptedMemberUserIdsForOrgs']> {
    throw new Error('Unexpected findAcceptedMemberUserIdsForOrgs in this test');
  }

  async removeMemberFromOrganization(
    ..._args: Parameters<OrganizationRepository['removeMemberFromOrganization']>
  ): ReturnType<OrganizationRepository['removeMemberFromOrganization']> {
    throw new Error('Unexpected removeMemberFromOrganization in this test');
  }
}

class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();

  async findById(): ReturnType<UserRepository['findById']> {
    return null;
  }
  async findByIds(): ReturnType<UserRepository['findByIds']> {
    return [];
  }
  async findByPhoneNumber(): ReturnType<UserRepository['findByPhoneNumber']> {
    return null;
  }
  async save(user: any): ReturnType<UserRepository['save']> {
    return user;
  }
  async exists(): ReturnType<UserRepository['exists']> {
    return false;
  }
  async searchUsers(): ReturnType<UserRepository['searchUsers']> {
    return [];
  }
  async searchUserByPhone(): ReturnType<UserRepository['searchUserByPhone']> {
    return null;
  }
  async isSuperAdmin(
    userId: string
  ): ReturnType<UserRepository['isSuperAdmin']> {
    return this.superAdmins.has(userId);
  }
  async findByNickname(): ReturnType<UserRepository['findByNickname']> {
    return null;
  }
  async isNicknameAvailable(): ReturnType<
    UserRepository['isNicknameAvailable']
  > {
    return true;
  }
  async updatePrivacySettings(): ReturnType<
    UserRepository['updatePrivacySettings']
  > {}

  async confirmUser(): ReturnType<UserRepository['confirmUser']> {}

  async deleteAddress(): ReturnType<UserRepository['deleteAddress']> {}

  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }

  async findByEmail(
    ..._args: Parameters<UserRepository['findByEmail']>
  ): ReturnType<UserRepository['findByEmail']> {
    throw new Error('Unexpected findByEmail in this test');
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
    allowMultiTreeMembership: false,
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
      directory: new PrismaOrganizationDirectory(prisma as PrismaClient),
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
      expect(result.value.admins[0].nickname.getValue()).toBe('asmith');
      expect(result.value.totalCount).toBe(2);
      expect(result.value.admins[0]).toMatchObject({
        id: 'admin-1',
        firstName: 'Alice',
        lastName: 'Smith',
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
