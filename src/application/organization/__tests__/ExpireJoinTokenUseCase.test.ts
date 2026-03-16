import { describe, it, expect, beforeEach } from 'vitest';
import { ExpireJoinTokenUseCase } from '../ExpireJoinTokenUseCase';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { JoinTokenRepository } from '../../../domain/organization/JoinTokenRepository';
import { JoinToken } from '../../../domain/organization/JoinToken';
import { Organization } from '../../../domain/organization/Organization';
import { JoinTokenErrors } from '../JoinTokenErrors';
import { OrganizationErrors } from '../OrganizationErrors';
import { JoinTokenDomainCodes } from '../../../domain/organization/JoinTokenDomainCodes';

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

function createActiveToken(id: string, organizationId: string): JoinToken {
  return JoinToken.reconstitute({
    id,
    organizationId,
    token: 'abc123test',
    description: 'Test token',
    maxUses: null,
    useCount: 0,
    createdById: 'creator-1',
    createdAt: new Date(),
    expiredAt: null,
  });
}

function createExpiredToken(id: string, organizationId: string): JoinToken {
  return JoinToken.reconstitute({
    id,
    organizationId,
    token: 'abc123test',
    description: 'Test token',
    maxUses: null,
    useCount: 0,
    createdById: 'creator-1',
    createdAt: new Date(),
    expiredAt: new Date(),
  });
}

describe('ExpireJoinTokenUseCase', () => {
  let useCase: ExpireJoinTokenUseCase;
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;
  let tokenRepo: MockJoinTokenRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();
    tokenRepo = new MockJoinTokenRepository();
    useCase = new ExpireJoinTokenUseCase({
      joinTokenRepository: tokenRepo,
      organizationRepository: orgRepo,
      userRepository: userRepo,
    });
  });

  it('succeeds when admin expires active token', async () => {
    const token = createActiveToken('jt-1', 'org-1');
    tokenRepo.addToken(token);
    orgRepo.addAdmin('org-1', 'admin-1');

    const result = await useCase.execute('jt-1', 'admin-1');

    expect(result.success).toBe(true);
    expect(tokenRepo.updatedToken).not.toBeNull();
    expect(tokenRepo.updatedToken!.expiredAt).not.toBeNull();
  });

  it('fails when token not found', async () => {
    const result = await useCase.execute('nonexistent', 'admin-1');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenErrors.NOT_FOUND);
    }
  });

  it('fails when actor is not admin/superadmin of token org', async () => {
    const token = createActiveToken('jt-1', 'org-1');
    tokenRepo.addToken(token);

    const result = await useCase.execute('jt-1', 'random-user');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  it('fails when token already expired', async () => {
    const token = createExpiredToken('jt-1', 'org-1');
    tokenRepo.addToken(token);
    orgRepo.addAdmin('org-1', 'admin-1');

    const result = await useCase.execute('jt-1', 'admin-1');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenDomainCodes.ALREADY_EXPIRED);
    }
  });
});
