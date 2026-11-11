/** Verifies Create Organization behavior through typed core ports.
 * User persistence doubles exclude obsolete moderation methods; access uses the checked moderation port. */
import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import { UserId } from '../../../domain/shared/EntityIds';
import { OrganizationName } from '../../../domain/organization/OrganizationValues';
import { OrganizationId } from '../../../domain/shared/EntityIds';
import { organizationCreationInputs } from '../../../domain/organization/__tests__/organizationTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { CreateOrganizationUseCase } from '../CreateOrganizationUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';
import { OrganizationErrors } from '../OrganizationErrors';
import { OrganizationDomainCodes } from '@/domain/organization/OrganizationDomainCodes';

// Mock repositories
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Organization[] = [];
  private admins: Map<string, Set<string>> = new Map();

  async save(
    organization: Organization
  ): ReturnType<OrganizationRepository['save']> {
    this.organizations.push(organization);

    return organization;
  }

  async findById(id: string): ReturnType<OrganizationRepository['findById']> {
    return this.organizations.find((org) => org.id === id) || null;
  }

  async findByName(
    name: string
  ): ReturnType<OrganizationRepository['findByName']> {
    return this.organizations.find((org) => org.name === name) || null;
  }

  async findByCreatorId(
    creatorId: string
  ): ReturnType<OrganizationRepository['findByCreatorId']> {
    return this.organizations.filter((org) => org.createdById === creatorId);
  }

  async findByParentId(
    parentId: string
  ): ReturnType<OrganizationRepository['findByParentId']> {
    return this.organizations.filter((org) => org.parentId === parentId);
  }

  async getAncestorIds(
    organizationId: string
  ): ReturnType<OrganizationRepository['getAncestorIds']> {
    const org = await this.findById(organizationId);

    if (!org || !org.parentId) {
      return OrganizationId.array().parse([]);
    }

    const ancestors: string[] = [org.parentId];
    const parentAncestors = await this.getAncestorIds(org.parentId);

    return OrganizationId.array().parse([...ancestors, ...parentAncestors]);
  }

  async getDescendantIds(
    organizationId: string
  ): ReturnType<OrganizationRepository['getDescendantIds']> {
    const children = await this.findByParentId(organizationId);
    const descendants: string[] = children.map((c) => c.id);

    for (const child of children) {
      const childDescendants = await this.getDescendantIds(child.id);
      descendants.push(...childDescendants);
    }

    return OrganizationId.array().parse(descendants);
  }

  async isUserMember(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserMember']> {
    return false;
  }

  async isUserAdmin(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserAdmin']> {
    const admins = this.admins.get(organizationId);

    return admins ? admins.has(userId) : false;
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

  async findMembershipsByUserId(
    userId: string
  ): ReturnType<OrganizationRepository['findMembershipsByUserId']> {
    return [];
  }

  async findAdminOrganizationsByUserId(
    userId: string
  ): ReturnType<OrganizationRepository['findAdminOrganizationsByUserId']> {
    return [];
  }

  async findAllWithStats(): ReturnType<
    OrganizationRepository['findAllWithStats']
  > {
    return this.organizations.map((org) => ({
      organization: org,
      memberCount: MemberCount.parse(0),
      firstAdmin: null,
      parentOrg: null,
    }));
  }

  async update(
    organization: Organization
  ): ReturnType<OrganizationRepository['update']> {
    const index = this.organizations.findIndex(
      (org) => org.id === organization.id
    );

    if (index !== -1) {
      this.organizations[index] = organization;
    }

    return organization;
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
  async searchOrganizationsWithStats(): ReturnType<
    OrganizationRepository['searchOrganizationsWithStats']
  > {
    return { organizations: [], totalCount: ResultCount.parse(0) };
  }
  async setParentId(
    organizationId: string,
    parentId: string | null
  ): ReturnType<OrganizationRepository['setParentId']> {}
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
  async getFullTreeOrgIds(): ReturnType<
    OrganizationRepository['getFullTreeOrgIds']
  > {
    return OrganizationId.array().parse([]);
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

  async findAcceptedMemberUserIdsIncludingDescendants(
    ..._args: Parameters<
      OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
    >
  ): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    throw new Error(
      'Unexpected findAcceptedMemberUserIdsIncludingDescendants in this test'
    );
  }

  async findAcceptedMemberUserIdsForOrgs(
    ..._args: Parameters<
      OrganizationRepository['findAcceptedMemberUserIdsForOrgs']
    >
  ): ReturnType<OrganizationRepository['findAcceptedMemberUserIdsForOrgs']> {
    throw new Error('Unexpected findAcceptedMemberUserIdsForOrgs in this test');
  }

  async removeUserFromOrganization(
    ..._args: Parameters<OrganizationRepository['removeUserFromOrganization']>
  ): ReturnType<OrganizationRepository['removeUserFromOrganization']> {
    throw new Error('Unexpected removeUserFromOrganization in this test');
  }

  async removeMemberFromOrganization(
    ..._args: Parameters<OrganizationRepository['removeMemberFromOrganization']>
  ): ReturnType<OrganizationRepository['removeMemberFromOrganization']> {
    throw new Error('Unexpected removeMemberFromOrganization in this test');
  }

  async findPendingRequestsByUserId(
    ..._args: Parameters<OrganizationRepository['findPendingRequestsByUserId']>
  ): ReturnType<OrganizationRepository['findPendingRequestsByUserId']> {
    throw new Error('Unexpected findPendingRequestsByUserId in this test');
  }
}

class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();

  async findById(id: string): ReturnType<UserRepository['findById']> {
    return null;
  }

  async findByIds(ids: string[]): ReturnType<UserRepository['findByIds']> {
    return [];
  }

  async findByPhoneNumber(
    phoneNumber: PhoneNumber
  ): ReturnType<UserRepository['findByPhoneNumber']> {
    return null;
  }

  async save(user: User): ReturnType<UserRepository['save']> {
    return user;
  }

  async exists(phoneNumber: PhoneNumber): ReturnType<UserRepository['exists']> {
    return false;
  }

  async searchUsers(query: string): ReturnType<UserRepository['searchUsers']> {
    return [];
  }

  async searchUserByPhone(
    _phone: Parameters<UserRepository['searchUserByPhone']>[0]
  ): ReturnType<UserRepository['searchUserByPhone']> {
    return null;
  }

  async isSuperAdmin(
    userId: string
  ): ReturnType<UserRepository['isSuperAdmin']> {
    return this.superAdmins.has(userId);
  }

  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
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

  async findByEmail(
    ..._args: Parameters<UserRepository['findByEmail']>
  ): ReturnType<UserRepository['findByEmail']> {
    throw new Error('Unexpected findByEmail in this test');
  }
}

describe('CreateOrganizationUseCase', () => {
  let useCase: CreateOrganizationUseCase;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();
    useCase = new CreateOrganizationUseCase({
      ...organizationCreationInputs,
      organizationRepository,
      userRepository,
      profanityChecker: {
        containsProfanity: () => false,
        findProfaneWords: () => [],
      },
    });
  });

  it('should create a new organization successfully', async () => {
    const input = {
      name: 'Test Organization',
      description: 'A test organization',
      parentId: null,
    };

    const result = await useCase.execute(input, 'user-123');

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.organization.name).toBe('Test Organization');
      expect(result.value.organization.description).toBe('A test organization');
      expect(result.value.organization.createdById).toBe('user-123');
      expect(result.value.organization.id).toBeTruthy();
    }
  });

  it('should fail if organization name is empty', async () => {
    const input = {
      name: '',
      description: 'This is a test organization',
      parentId: null,
    };

    const result = await useCase.execute(input, 'user-123');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_NAME_EMPTY
      );
    }
  });

  it('should fail if organization description is empty', async () => {
    const input = {
      name: 'Test Organization',
      description: '',
      parentId: null,
    };

    const result = await useCase.execute(input, 'user-123');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_EMPTY
      );
    }
  });

  it('should fail if parent organization does not exist', async () => {
    const input = {
      name: 'Child Organization',
      description: 'This is a child organization',
      parentId: 'non-existent-org',
    };

    const result = await useCase.execute(input, 'user-123');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.PARENT_NOT_FOUND);
    }
  });

  it('should create a child organization under a valid parent when user is admin', async () => {
    // First create a parent organization
    const parentInput = {
      name: 'Parent Organization',
      description: 'This is a parent organization',
      parentId: null,
    };

    const parentResult = await useCase.execute(parentInput, 'user-123');
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parentId = parentResult.value.organization.id;
      organizationRepository.addAdmin(parentId, 'admin-user');

      const childInput = {
        name: 'Child Organization',
        description: 'This is a child organization',
        parentId,
      };

      const childResult = await useCase.execute(childInput, 'admin-user');

      expect(childResult.success).toBe(true);

      if (childResult.success) {
        expect(childResult.value.organization.parentId).toBe(parentId);
      }
    }
  });

  it('should fail to create child organization when user is not admin of parent', async () => {
    const parentInput = {
      name: 'Parent Organization',
      description: 'This is a parent organization',
      parentId: null,
    };

    const parentResult = await useCase.execute(parentInput, 'user-123');
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parentId = parentResult.value.organization.id;

      const childInput = {
        name: 'Child Organization',
        description: 'This is a child organization',
        parentId,
      };

      const childResult = await useCase.execute(childInput, 'non-admin-user');

      expect(childResult.success).toBe(false);

      if (!childResult.success) {
        expect(childResult.error).toBe(OrganizationErrors.NOT_ADMIN);
      }
    }
  });

  it('should allow superadmin to create child organization without being org admin', async () => {
    const parentInput = {
      name: 'Parent Organization',
      description: 'This is a parent organization',
      parentId: null,
    };

    const parentResult = await useCase.execute(parentInput, 'user-123');
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parentId = parentResult.value.organization.id;
      userRepository.addSuperAdmin('superadmin-1');

      const childInput = {
        name: 'Child Organization',
        description: 'This is a child organization',
        parentId,
      };

      const childResult = await useCase.execute(childInput, 'superadmin-1');

      expect(childResult.success).toBe(true);

      if (childResult.success) {
        expect(childResult.value.organization.parentId).toBe(parentId);
      }
    }
  });
});
