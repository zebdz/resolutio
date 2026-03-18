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

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }

  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    const orgAdmins = this.admins.get(organizationId);

    return orgAdmins ? orgAdmins.has(userId) : false;
  }

  // Test helpers
  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }

  async addAdmin(organizationId: string, userId: string) {
    if (!this.admins.has(organizationId)) {
      this.admins.set(organizationId, new Set());
    }

    this.admins.get(organizationId)!.add(userId);
  }

  // Unused interface methods — stubs
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

// Mock UserRepository — only isSuperAdmin used
class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();

  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }

  addSuperAdmin(userId: string) {
    this.superAdmins.add(userId);
  }

  // Unused stubs
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
}

// Mock JoinTokenRepository — only save used
class MockJoinTokenRepository implements JoinTokenRepository {
  public savedToken: JoinToken | null = null;

  async save(joinToken: JoinToken): Promise<JoinToken> {
    // Simulate DB assigning an ID
    (joinToken as any).props.id = `jt-${Date.now()}`;
    this.savedToken = joinToken;

    return joinToken;
  }

  // Unused stubs
  async update(joinToken: JoinToken) {
    return joinToken;
  }
  async findById() {
    return null;
  }
  async findByToken() {
    return null;
  }
  async findByOrganizationId() {
    return { tokens: [], totalCount: 0 };
  }
  async tryIncrementUseCount() {
    return false;
  }
}

function createOrg(id: string, opts?: { archived?: boolean }): Organization {
  const result = Organization.create('Test Org', 'Test description', 'creator');
  expect(result.success).toBe(true);
  const org = (result as any).value as Organization;
  (org as any).props.id = id;

  if (opts?.archived) {
    org.archive();
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
