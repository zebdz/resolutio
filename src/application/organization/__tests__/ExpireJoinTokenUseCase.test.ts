/** Verifies Expire Join Token behavior through typed core ports.
 * User persistence doubles exclude obsolete moderation methods; access uses the checked moderation port. */
import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import { UserId } from '../../../domain/shared/EntityIds';
import { OrganizationName } from '../../../domain/organization/OrganizationValues';
import { OrganizationId } from '../../../domain/shared/EntityIds';
import { joinTokenCreationInputs } from '../../../domain/organization/__tests__/joinTokenTestValues';
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

  async isUserAdmin(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserAdmin']> {
    const orgAdmins = this.admins.get(organizationId);

    return orgAdmins ? orgAdmins.has(userId) : false;
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

  // Unused stubs
  async save(org: Organization): ReturnType<OrganizationRepository['save']> {
    return org;
  }
  async findById(): ReturnType<OrganizationRepository['findById']> {
    return null;
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

// Mock UserRepository
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

// Mock JoinTokenRepository
class MockJoinTokenRepository implements JoinTokenRepository {
  private tokens: Map<string, JoinToken> = new Map();
  public updatedToken: JoinToken | null = null;

  addToken(token: JoinToken) {
    this.tokens.set(token.id, token);
  }

  async findById(id: string): ReturnType<JoinTokenRepository['findById']> {
    return this.tokens.get(id) || null;
  }

  async update(
    joinToken: JoinToken
  ): ReturnType<JoinTokenRepository['update']> {
    this.updatedToken = joinToken;

    return joinToken;
  }

  // Unused stubs
  async save(joinToken: JoinToken): ReturnType<JoinTokenRepository['save']> {
    return joinToken;
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

function createActiveToken(id: string, organizationId: string): JoinToken {
  return JoinToken.reconstitute({
    id,
    organizationId,
    token: 'abc234test',
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
    token: 'abc234test',
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
      ...joinTokenCreationInputs,
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
