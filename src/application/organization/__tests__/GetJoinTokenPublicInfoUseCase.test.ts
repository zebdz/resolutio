/** Join-link public reads enforce link availability and decode member totals.
 * Storage is simulated behind the real directory adapter; no database I/O occurs. */
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaOrganizationDirectory } from '@/infrastructure/repositories/PrismaOrganizationDirectory';
import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import { UserId } from '../../../domain/shared/EntityIds';
import { OrganizationName } from '../../../domain/organization/OrganizationValues';
import { OrganizationId } from '../../../domain/shared/EntityIds';
import { describe, it, expect, beforeEach } from 'vitest';
import { GetJoinTokenPublicInfoUseCase } from '../GetJoinTokenPublicInfoUseCase';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { JoinTokenRepository } from '../../../domain/organization/JoinTokenRepository';
import { JoinToken } from '../../../domain/organization/JoinToken';
import { Organization } from '../../../domain/organization/Organization';
import { JoinTokenErrors } from '../JoinTokenErrors';
import { OrganizationErrors } from '../OrganizationErrors';

// Mock PrismaClient
class MockPrismaClient {
  public organizationUser = {
    count: async (_args: any): Promise<number> => {
      return 0;
    },
  };
}

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();

  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }

  async findById(id: string): ReturnType<OrganizationRepository['findById']> {
    return this.organizations.get(id) || null;
  }

  // Unused stubs
  async isUserAdmin(): ReturnType<OrganizationRepository['isUserAdmin']> {
    return false;
  }
  async addAdmin(): ReturnType<OrganizationRepository['addAdmin']> {}
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

// Mock JoinTokenRepository
class MockJoinTokenRepository implements JoinTokenRepository {
  private tokensByValue: Map<string, JoinToken> = new Map();

  addTokenByValue(token: JoinToken) {
    this.tokensByValue.set(token.token, token);
  }

  async findByToken(
    tokenValue: string
  ): ReturnType<JoinTokenRepository['findByToken']> {
    return this.tokensByValue.get(tokenValue) || null;
  }

  // Unused stubs
  async save(joinToken: JoinToken): ReturnType<JoinTokenRepository['save']> {
    return joinToken;
  }
  async update(
    joinToken: JoinToken
  ): ReturnType<JoinTokenRepository['update']> {
    return joinToken;
  }
  async findById(): ReturnType<JoinTokenRepository['findById']> {
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

function createActiveToken(
  organizationId: string,
  tokenValue: string = 'abc234test'
): JoinToken {
  return JoinToken.reconstitute({
    id: 'jt-1',
    organizationId,
    token: tokenValue,
    description: 'Test token',
    maxUses: null,
    useCount: 0,
    createdById: 'creator-1',
    createdAt: new Date(),
    expiredAt: null,
  });
}

function createExpiredToken(
  organizationId: string,
  tokenValue: string = 'abc234test'
): JoinToken {
  return JoinToken.reconstitute({
    id: 'jt-1',
    organizationId,
    token: tokenValue,
    description: 'Test token',
    maxUses: null,
    useCount: 0,
    createdById: 'creator-1',
    createdAt: new Date(),
    expiredAt: new Date(),
  });
}

function createExhaustedToken(
  organizationId: string,
  tokenValue: string = 'abc234test'
): JoinToken {
  return JoinToken.reconstitute({
    id: 'jt-1',
    organizationId,
    token: tokenValue,
    description: 'Test token',
    maxUses: 5,
    useCount: 5,
    createdById: 'creator-1',
    createdAt: new Date(),
    expiredAt: null,
  });
}

function createOrg(
  id: string,
  name: string,
  description: string = 'Test description'
): Organization {
  return Organization.reconstitute({
    id,
    name,
    description,
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: false,
  });
}

function createArchivedOrg(id: string, name: string): Organization {
  return Organization.reconstitute({
    id,
    name,
    description: 'Archived org',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: new Date(),
    allowMultiTreeMembership: false,
  });
}

describe('GetJoinTokenPublicInfoUseCase', () => {
  let useCase: GetJoinTokenPublicInfoUseCase;
  let orgRepo: MockOrganizationRepository;
  let tokenRepo: MockJoinTokenRepository;
  let prisma: MockPrismaClient;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    tokenRepo = new MockJoinTokenRepository();
    prisma = new MockPrismaClient();
    useCase = new GetJoinTokenPublicInfoUseCase({
      joinTokenRepository: tokenRepo,
      organizationRepository: orgRepo,
      directory: new PrismaOrganizationDirectory(
        prisma as unknown as PrismaClient
      ),
    });
  });

  it('returns org name, description, member count for valid active token', async () => {
    const org = createOrg('org-1', 'My Organization', 'A great org');
    orgRepo.addOrganization(org);

    const token = createActiveToken('org-1', 'abc234defg');
    tokenRepo.addTokenByValue(token);

    prisma.organizationUser.count = async () => 42;

    const result = await useCase.execute('abc234defg');

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.organizationId).toBe('org-1');
      expect(result.value.organizationName).toBe('My Organization');
      expect(result.value.organizationDescription).toBe('A great org');
      expect(result.value.memberCount).toBe(42);
    }
  });

  it.each([-1, 0.5, Infinity])(
    'rejects invalid stored member count %s',
    async (count) => {
      orgRepo.addOrganization(
        createOrg('org-1', 'My Organization', 'A great org')
      );
      tokenRepo.addTokenByValue(createActiveToken('org-1', 'abc234defg'));
      prisma.organizationUser.count = async () => count;

      expect(await useCase.execute('abc234defg')).toEqual({
        success: false,
        error: 'common.errors.unexpected',
      });
    }
  );

  it('fails when token not found', async () => {
    const result = await useCase.execute('nonexistent');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenErrors.NOT_FOUND);
    }
  });

  it('fails when token expired', async () => {
    const token = createExpiredToken('org-1', 'abc234defh');
    tokenRepo.addTokenByValue(token);

    const result = await useCase.execute('abc234defh');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenErrors.EXPIRED);
    }
  });

  it('fails when token exhausted (useCount >= maxUses)', async () => {
    const token = createExhaustedToken('org-1', 'abc234defj');
    tokenRepo.addTokenByValue(token);

    const result = await useCase.execute('abc234defj');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenErrors.EXHAUSTED);
    }
  });

  it('fails when org archived', async () => {
    const org = createArchivedOrg('org-1', 'Archived Org');
    orgRepo.addOrganization(org);

    const token = createActiveToken('org-1', 'abc234defk');
    tokenRepo.addTokenByValue(token);

    const result = await useCase.execute('abc234defk');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.ARCHIVED);
    }
  });
});
