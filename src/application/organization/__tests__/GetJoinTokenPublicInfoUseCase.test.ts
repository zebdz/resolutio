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

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }

  // Unused stubs
  async isUserAdmin() {
    return false;
  }
  async addAdmin() {}
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

// Mock JoinTokenRepository
class MockJoinTokenRepository implements JoinTokenRepository {
  private tokensByValue: Map<string, JoinToken> = new Map();

  addTokenByValue(token: JoinToken) {
    this.tokensByValue.set(token.token, token);
  }

  async findByToken(tokenValue: string): Promise<JoinToken | null> {
    return this.tokensByValue.get(tokenValue) || null;
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
  async findByOrganizationId() {
    return { tokens: [], totalCount: 0 };
  }
  async tryIncrementUseCount() {
    return false;
  }
}

function createActiveToken(
  organizationId: string,
  tokenValue: string = 'abc123test'
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
  tokenValue: string = 'abc123test'
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
  tokenValue: string = 'abc123test'
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
      prisma: prisma as any,
    });
  });

  it('returns org name, description, member count for valid active token', async () => {
    const org = createOrg('org-1', 'My Organization', 'A great org');
    orgRepo.addOrganization(org);

    const token = createActiveToken('org-1', 'valid-token');
    tokenRepo.addTokenByValue(token);

    prisma.organizationUser.count = async () => 42;

    const result = await useCase.execute('valid-token');

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.organizationId).toBe('org-1');
      expect(result.value.organizationName).toBe('My Organization');
      expect(result.value.organizationDescription).toBe('A great org');
      expect(result.value.memberCount).toBe(42);
    }
  });

  it('fails when token not found', async () => {
    const result = await useCase.execute('nonexistent');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenErrors.NOT_FOUND);
    }
  });

  it('fails when token expired', async () => {
    const token = createExpiredToken('org-1', 'expired-token');
    tokenRepo.addTokenByValue(token);

    const result = await useCase.execute('expired-token');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenErrors.EXPIRED);
    }
  });

  it('fails when token exhausted (useCount >= maxUses)', async () => {
    const token = createExhaustedToken('org-1', 'exhausted-token');
    tokenRepo.addTokenByValue(token);

    const result = await useCase.execute('exhausted-token');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenErrors.EXHAUSTED);
    }
  });

  it('fails when org archived', async () => {
    const org = createArchivedOrg('org-1', 'Archived Org');
    orgRepo.addOrganization(org);

    const token = createActiveToken('org-1', 'active-token');
    tokenRepo.addTokenByValue(token);

    const result = await useCase.execute('active-token');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.ARCHIVED);
    }
  });
});
