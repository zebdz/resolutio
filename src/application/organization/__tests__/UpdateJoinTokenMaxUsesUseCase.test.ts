import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateJoinTokenMaxUsesUseCase } from '../UpdateJoinTokenMaxUsesUseCase';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { JoinTokenRepository } from '../../../domain/organization/JoinTokenRepository';
import { JoinToken } from '../../../domain/organization/JoinToken';
import { Organization } from '../../../domain/organization/Organization';
import { JoinTokenErrors } from '../JoinTokenErrors';
import { OrganizationErrors } from '../OrganizationErrors';

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private admins: Map<string, Set<string>> = new Map();

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
  async findById() {
    return null;
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
  private tokens: Map<string, JoinToken> = new Map();
  public updatedToken: JoinToken | null = null;

  addToken(token: JoinToken) {
    this.tokens.set(token.id, token);
  }

  async findById(id: string): Promise<JoinToken | null> {
    return this.tokens.get(id) || null;
  }

  async update(joinToken: JoinToken): Promise<JoinToken> {
    this.updatedToken = joinToken;

    return joinToken;
  }

  // Unused stubs
  async save(joinToken: JoinToken) {
    return joinToken;
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

function createToken(
  id: string,
  organizationId: string,
  maxUses: number | null = null
): JoinToken {
  return JoinToken.reconstitute({
    id,
    organizationId,
    token: 'abc123test',
    description: 'Test token',
    maxUses,
    useCount: 0,
    createdById: 'creator-1',
    createdAt: new Date(),
    expiredAt: null,
  });
}

describe('UpdateJoinTokenMaxUsesUseCase', () => {
  let useCase: UpdateJoinTokenMaxUsesUseCase;
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;
  let tokenRepo: MockJoinTokenRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();
    tokenRepo = new MockJoinTokenRepository();
    useCase = new UpdateJoinTokenMaxUsesUseCase({
      joinTokenRepository: tokenRepo,
      organizationRepository: orgRepo,
      userRepository: userRepo,
    });
  });

  it('succeeds when admin updates maxUses to a number', async () => {
    const token = createToken('jt-1', 'org-1');
    tokenRepo.addToken(token);
    orgRepo.addAdmin('org-1', 'admin-1');

    const result = await useCase.execute(
      { tokenId: 'jt-1', maxUses: 50 },
      'admin-1'
    );

    expect(result.success).toBe(true);
    expect(tokenRepo.updatedToken).not.toBeNull();
    expect(tokenRepo.updatedToken!.maxUses).toBe(50);
  });

  it('succeeds when admin sets maxUses to null (unlimited)', async () => {
    const token = createToken('jt-1', 'org-1', 100);
    tokenRepo.addToken(token);
    orgRepo.addAdmin('org-1', 'admin-1');

    const result = await useCase.execute(
      { tokenId: 'jt-1', maxUses: null },
      'admin-1'
    );

    expect(result.success).toBe(true);
    expect(tokenRepo.updatedToken).not.toBeNull();
    expect(tokenRepo.updatedToken!.maxUses).toBeNull();
  });

  it('succeeds when superadmin updates maxUses', async () => {
    const token = createToken('jt-1', 'org-1');
    tokenRepo.addToken(token);
    userRepo.addSuperAdmin('super-1');

    const result = await useCase.execute(
      { tokenId: 'jt-1', maxUses: 25 },
      'super-1'
    );

    expect(result.success).toBe(true);
    expect(tokenRepo.updatedToken!.maxUses).toBe(25);
  });

  it('fails when token not found', async () => {
    const result = await useCase.execute(
      { tokenId: 'nonexistent', maxUses: 10 },
      'admin-1'
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenErrors.NOT_FOUND);
    }
  });

  it('fails when actor not admin/superadmin', async () => {
    const token = createToken('jt-1', 'org-1');
    tokenRepo.addToken(token);

    const result = await useCase.execute(
      { tokenId: 'jt-1', maxUses: 10 },
      'random-user'
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });
});
