import { describe, it, expect, beforeEach } from 'vitest';
import { GetJoinTokensByOrgUseCase } from '../GetJoinTokensByOrgUseCase';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import {
  JoinTokenRepository,
  JoinTokenWithCreator,
} from '../../../domain/organization/JoinTokenRepository';
import { JoinToken } from '../../../domain/organization/JoinToken';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationErrors } from '../OrganizationErrors';

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private admins: Map<string, Set<string>> = new Map();

  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }

  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    const orgAdmins = this.admins.get(organizationId);

    return orgAdmins ? orgAdmins.has(userId) : false;
  }

  async addAdmin(organizationId: string, userId: string) {
    if (!this.admins.has(organizationId)) {
      this.admins.set(organizationId, new Set());
    }

    this.admins.get(organizationId)!.add(userId);
  }

  // Unused stubs
  async save(org: Organization) {
    return org;
  }
  async findByName() {
    return null;
  }
  async findByCreatorId() {
    return [];
  }
  async findByParentId() {
    return [];
  }
  async getAncestorIds() {
    return [];
  }
  async getDescendantIds() {
    return [];
  }
  async getFullTreeOrgIds() {
    return [];
  }
  async isUserMember() {
    return false;
  }
  async findMembershipsByUserId() {
    return [];
  }
  async findAdminOrganizationsByUserId() {
    return [];
  }
  async findAllWithStats() {
    return [];
  }
  async searchOrganizationsWithStats() {
    return { organizations: [], totalCount: 0 };
  }
  async update(org: Organization) {
    return org;
  }
  async findAcceptedMemberUserIdsIncludingDescendants() {
    return [];
  }
  async removeUserFromOrganization() {}
  async findPendingRequestsByUserId() {
    return [];
  }
  async getAncestors() {
    return [];
  }
  async getChildrenWithStats() {
    return [];
  }
  async getHierarchyTree() {
    return {
      ancestors: [],
      tree: { id: '', name: '', memberCount: 0, children: [] },
    };
  }
  async setParentId() {}
  async findAdminUserIds() {
    return [];
  }
  async removeAdmin() {}
  async searchByNameFuzzy() {
    return [];
  }
  async getRootAllowMultiTreeMembership() {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs() {
    return [];
  }
  async setAllowMultiTreeMembership() {}
}

// Mock UserRepository
class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();

  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }

  addSuperAdmin(userId: string) {
    this.superAdmins.add(userId);
  }

  async findById() {
    return null;
  }
  async findByIds() {
    return [];
  }
  async findByPhoneNumber() {
    return null;
  }
  async save(user: any) {
    return user;
  }
  async confirmUser() {}
  async updatePrivacySettings() {}
  async exists() {
    return false;
  }
  async searchUsers() {
    return [];
  }
  async searchUserByPhone() {
    return null;
  }
  async findByNickname() {
    return null;
  }
  async isNicknameAvailable() {
    return true;
  }
  async isUserBlocked() {
    return false;
  }
  async blockUser() {}
  async unblockUser() {}
  async getBlockStatus() {
    return null;
  }
  async deleteAddress(): Promise<void> {}
  async getBlockedUserIds(): Promise<string[]> {
    return [];
  }
}

// Mock JoinTokenRepository
class MockJoinTokenRepository implements JoinTokenRepository {
  private tokensByOrg: Map<
    string,
    { tokens: JoinTokenWithCreator[]; totalCount: number }
  > = new Map();

  setTokensForOrg(
    organizationId: string,
    tokens: JoinTokenWithCreator[],
    totalCount: number
  ) {
    this.tokensByOrg.set(organizationId, { tokens, totalCount });
  }

  async findByOrganizationId(
    organizationId: string
  ): Promise<{ tokens: JoinTokenWithCreator[]; totalCount: number }> {
    return (
      this.tokensByOrg.get(organizationId) || {
        tokens: [],
        totalCount: 0,
      }
    );
  }

  // Unused stubs
  async save(joinToken: JoinToken) {
    return joinToken;
  }
  async update(joinToken: JoinToken) {
    return joinToken;
  }
  async findById() {
    return null;
  }
  async findByToken() {
    return null;
  }
  async tryIncrementUseCount() {
    return false;
  }
}

function createOrg(id: string, name: string): Organization {
  return Organization.reconstitute({
    id,
    name,
    description: 'Test org',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: false,
  });
}

function createTokenWithCreator(
  id: string,
  organizationId: string,
  creatorName: string
): JoinTokenWithCreator {
  return {
    joinToken: JoinToken.reconstitute({
      id,
      organizationId,
      token: `token-${id}`,
      description: 'Test token',
      maxUses: null,
      useCount: 0,
      createdById: 'creator-1',
      createdAt: new Date(),
      expiredAt: null,
    }),
    creatorName,
  };
}

describe('GetJoinTokensByOrgUseCase', () => {
  let useCase: GetJoinTokensByOrgUseCase;
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;
  let tokenRepo: MockJoinTokenRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();
    tokenRepo = new MockJoinTokenRepository();
    useCase = new GetJoinTokensByOrgUseCase({
      organizationRepository: orgRepo,
      joinTokenRepository: tokenRepo,
      userRepository: userRepo,
    });
  });

  it('returns paginated tokens for admin', async () => {
    const org = createOrg('org-1', 'Test Org');
    orgRepo.addOrganization(org);
    orgRepo.addAdmin('org-1', 'admin-1');

    const t1 = createTokenWithCreator('jt-1', 'org-1', 'John Doe');
    const t2 = createTokenWithCreator('jt-2', 'org-1', 'Jane Smith');
    tokenRepo.setTokensForOrg('org-1', [t1, t2], 2);

    const result = await useCase.execute(
      { organizationId: 'org-1' },
      'admin-1'
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.tokens).toHaveLength(2);
      expect(result.value.totalCount).toBe(2);
    }
  });

  it('returns empty list when no tokens', async () => {
    const org = createOrg('org-1', 'Test Org');
    orgRepo.addOrganization(org);
    orgRepo.addAdmin('org-1', 'admin-1');

    const result = await useCase.execute(
      { organizationId: 'org-1' },
      'admin-1'
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.tokens).toHaveLength(0);
      expect(result.value.totalCount).toBe(0);
    }
  });

  it('fails when org not found', async () => {
    const result = await useCase.execute(
      { organizationId: 'nonexistent' },
      'admin-1'
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_FOUND);
    }
  });

  it('fails when actor not admin/superadmin', async () => {
    const org = createOrg('org-1', 'Test Org');
    orgRepo.addOrganization(org);

    const result = await useCase.execute(
      { organizationId: 'org-1' },
      'random-user'
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  it('succeeds when superadmin requests tokens', async () => {
    const org = createOrg('org-1', 'Test Org');
    orgRepo.addOrganization(org);
    userRepo.addSuperAdmin('super-1');

    const t1 = createTokenWithCreator('jt-1', 'org-1', 'John Doe');
    tokenRepo.setTokensForOrg('org-1', [t1], 1);

    const result = await useCase.execute(
      { organizationId: 'org-1' },
      'super-1'
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.tokens).toHaveLength(1);
      expect(result.value.totalCount).toBe(1);
    }
  });
});
