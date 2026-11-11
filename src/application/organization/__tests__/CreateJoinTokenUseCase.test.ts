/** Verifies Create Join Token behavior through typed core ports.
 * User persistence doubles exclude obsolete moderation methods; access uses the checked moderation port. */
import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import { UserId } from '../../../domain/shared/EntityIds';
import { OrganizationName } from '../../../domain/organization/OrganizationValues';
import { OrganizationId } from '../../../domain/shared/EntityIds';
import { joinTokenCreationInputs } from '../../../domain/organization/__tests__/joinTokenTestValues';
import {
  createOrganization,
  organizationTestInstant,
} from '../../../domain/organization/__tests__/organizationTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { CreateJoinTokenUseCase } from '../CreateJoinTokenUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { JoinTokenRepository } from '../../../domain/organization/JoinTokenRepository';
import { JoinToken } from '../../../domain/organization/JoinToken';
import { OrganizationErrors } from '../OrganizationErrors';

// Mock OrganizationRepository — only methods used by this use case
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private admins: Map<string, Set<string>> = new Map(); // orgId -> Set<userId>

  async findById(id: string): ReturnType<OrganizationRepository['findById']> {
    return this.organizations.get(id) || null;
  }

  async isUserAdmin(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserAdmin']> {
    const orgAdmins = this.admins.get(organizationId);

    return orgAdmins ? orgAdmins.has(userId) : false;
  }

  // Test helpers
  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }

  async addAdmin(
    organizationId: string,
    userId: string
  ): ReturnType<OrganizationRepository['addAdmin']> {
    if (!this.admins.has(organizationId)) {
      this.admins.set(organizationId, new Set());
    }

    this.admins.get(organizationId)!.add(userId);
  }

  // Unused interface methods — stubs
  async save(org: Organization): ReturnType<OrganizationRepository['save']> {
    return org;
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
  async isUserMember(): ReturnType<OrganizationRepository['isUserMember']> {
    return false;
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
  async setParentId(): ReturnType<OrganizationRepository['setParentId']> {}
  async findAdminUserIds(): ReturnType<
    OrganizationRepository['findAdminUserIds']
  > {
    return UserId.array().parse([]);
  }
  async removeAdmin(): ReturnType<OrganizationRepository['removeAdmin']> {}
  async searchByNameFuzzy(): ReturnType<
    OrganizationRepository['searchByNameFuzzy']
  > {
    return [];
  }
  async getRootAllowMultiTreeMembership(): ReturnType<
    OrganizationRepository['getRootAllowMultiTreeMembership']
  > {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs(): ReturnType<
    OrganizationRepository['findUsersWithMultipleMembershipsInOrgs']
  > {
    return UserId.array().parse([]);
  }
  async setAllowMultiTreeMembership(): ReturnType<
    OrganizationRepository['setAllowMultiTreeMembership']
  > {}

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

// Mock UserRepository — only isSuperAdmin used
class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();

  async isSuperAdmin(
    userId: string
  ): ReturnType<UserRepository['isSuperAdmin']> {
    return this.superAdmins.has(userId);
  }

  addSuperAdmin(userId: string) {
    this.superAdmins.add(userId);
  }

  // Unused stubs
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
  async confirmUser(): ReturnType<UserRepository['confirmUser']> {}
  async updatePrivacySettings(): ReturnType<
    UserRepository['updatePrivacySettings']
  > {}
  async exists(): ReturnType<UserRepository['exists']> {
    return false;
  }
  async searchUsers(): ReturnType<UserRepository['searchUsers']> {
    return [];
  }
  async searchUserByPhone(): ReturnType<UserRepository['searchUserByPhone']> {
    return null;
  }
  async findByNickname(): ReturnType<UserRepository['findByNickname']> {
    return null;
  }
  async isNicknameAvailable(): ReturnType<
    UserRepository['isNicknameAvailable']
  > {
    return true;
  }

  async deleteAddress(): ReturnType<UserRepository['deleteAddress']> {}

  async findByEmail(
    ..._args: Parameters<UserRepository['findByEmail']>
  ): ReturnType<UserRepository['findByEmail']> {
    throw new Error('Unexpected findByEmail in this test');
  }
}

// Mock JoinTokenRepository — only save used
class MockJoinTokenRepository implements JoinTokenRepository {
  public savedToken: JoinToken | null = null;

  async save(joinToken: JoinToken): ReturnType<JoinTokenRepository['save']> {
    this.savedToken = joinToken;

    return joinToken;
  }

  // Unused stubs
  async update(
    joinToken: JoinToken
  ): ReturnType<JoinTokenRepository['update']> {
    return joinToken;
  }
  async findById(): ReturnType<JoinTokenRepository['findById']> {
    return null;
  }
  async findByToken(): ReturnType<JoinTokenRepository['findByToken']> {
    return null;
  }
  async findByOrganizationId(): ReturnType<
    JoinTokenRepository['findByOrganizationId']
  > {
    return { tokens: [], totalCount: ResultCount.parse(0) };
  }
  async tryIncrementUseCount(): ReturnType<
    JoinTokenRepository['tryIncrementUseCount']
  > {
    return false;
  }
}

function createOrg(id: string, opts?: { archived?: boolean }): Organization {
  const result = createOrganization('Test Org', 'Test description', 'creator');
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  const org = Organization.reconstitute({ ...result.value.toJSON(), id });

  if (opts?.archived) {
    org.archive(organizationTestInstant);
  }

  return org;
}

describe('CreateJoinTokenUseCase', () => {
  let useCase: CreateJoinTokenUseCase;
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;
  let tokenRepo: MockJoinTokenRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();
    tokenRepo = new MockJoinTokenRepository();
    useCase = new CreateJoinTokenUseCase({
      ...joinTokenCreationInputs,
      organizationRepository: orgRepo,
      joinTokenRepository: tokenRepo,
      userRepository: userRepo,
    });
  });

  it('succeeds when admin creates token with description only', async () => {
    const org = createOrg('org-1');
    orgRepo.addOrganization(org);
    orgRepo.addAdmin('org-1', 'admin-1');

    const result = await useCase.execute(
      { organizationId: 'org-1', description: 'General invite link' },
      'admin-1'
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.organizationId).toBe('org-1');
      expect(result.value.description).toBe('General invite link');
      expect(result.value.maxUses).toBeNull();
      expect(result.value.token).toBeTruthy();
    }

    expect(tokenRepo.savedToken).not.toBeNull();
  });

  it('succeeds when admin creates token with description + maxUses', async () => {
    const org = createOrg('org-1');
    orgRepo.addOrganization(org);
    orgRepo.addAdmin('org-1', 'admin-1');

    const result = await useCase.execute(
      {
        organizationId: 'org-1',
        description: 'Limited invite',
        maxUses: 50,
      },
      'admin-1'
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.maxUses).toBe(50);
    }
  });

  it('fails when org not found', async () => {
    const result = await useCase.execute(
      { organizationId: 'nonexistent', description: 'test' },
      'admin-1'
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_FOUND);
    }
  });

  it('fails when org archived', async () => {
    const org = createOrg('org-1', { archived: true });
    orgRepo.addOrganization(org);

    const result = await useCase.execute(
      { organizationId: 'org-1', description: 'test' },
      'admin-1'
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.ARCHIVED);
    }
  });

  it('fails when actor is not admin or superadmin', async () => {
    const org = createOrg('org-1');
    orgRepo.addOrganization(org);

    const result = await useCase.execute(
      { organizationId: 'org-1', description: 'test' },
      'random-user'
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  it('succeeds when actor is superadmin (not org admin)', async () => {
    const org = createOrg('org-1');
    orgRepo.addOrganization(org);
    userRepo.addSuperAdmin('super-1');

    const result = await useCase.execute(
      { organizationId: 'org-1', description: 'Superadmin link' },
      'super-1'
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.createdById).toBe('super-1');
    }
  });
});
