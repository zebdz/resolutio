/** Verifies Unarchive Organization behavior through application ports.
 * Notification doubles return explicit append outcomes, matching the production writer. */
import { success } from '@/domain/shared/Result';
import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import {
  notificationIds,
  notificationClock,
} from '@/application/shared/__tests__/notificationCreation';
import { UserId } from '../../../domain/shared/EntityIds';
import { OrganizationName } from '../../../domain/organization/OrganizationValues';
import { OrganizationId } from '../../../domain/shared/EntityIds';
import {
  createOrganization,
  organizationTestInstant,
} from '../../../domain/organization/__tests__/organizationTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { UnarchiveOrganizationUseCase } from '../UnarchiveOrganizationUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private memberUserIds: Map<string, string[]> = new Map();

  async save(
    organization: Organization
  ): ReturnType<OrganizationRepository['save']> {
    this.organizations.set(organization.id, organization);

    return organization;
  }

  async findById(id: string): ReturnType<OrganizationRepository['findById']> {
    return this.organizations.get(id) || null;
  }

  async findByName(
    name: string
  ): ReturnType<OrganizationRepository['findByName']> {
    return null;
  }

  async findByCreatorId(
    creatorId: string
  ): ReturnType<OrganizationRepository['findByCreatorId']> {
    return [];
  }

  async findByParentId(
    parentId: string
  ): ReturnType<OrganizationRepository['findByParentId']> {
    return [];
  }

  async getAncestorIds(
    organizationId: string
  ): ReturnType<OrganizationRepository['getAncestorIds']> {
    return OrganizationId.array().parse([]);
  }

  async getDescendantIds(
    organizationId: string
  ): ReturnType<OrganizationRepository['getDescendantIds']> {
    return OrganizationId.array().parse([]);
  }

  async isUserMember(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserMember']> {
    return false;
  }

  async findAll(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }

  async update(
    organization: Organization
  ): ReturnType<OrganizationRepository['update']> {
    this.organizations.set(organization.id, organization);

    return organization;
  }

  async isUserAdmin(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserAdmin']> {
    return false;
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

  async addAdmin(): ReturnType<OrganizationRepository['addAdmin']> {}
  async removeAdmin(): ReturnType<OrganizationRepository['removeAdmin']> {}

  async getFullTreeOrgIds(): ReturnType<
    OrganizationRepository['getFullTreeOrgIds']
  > {
    return OrganizationId.array().parse([]);
  }

  async findAcceptedMemberUserIdsIncludingDescendants(
    organizationId: string
  ): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    return UserId.array().parse(this.memberUserIds.get(organizationId) || []);
  }

  async removeUserFromOrganization(): ReturnType<
    OrganizationRepository['removeUserFromOrganization']
  > {}

  async findPendingRequestsByUserId(): ReturnType<
    OrganizationRepository['findPendingRequestsByUserId']
  > {
    return [];
  }
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
  setMemberUserIds(orgId: string, userIds: string[]) {
    this.memberUserIds.set(orgId, userIds);
  }

  clear(): void {
    this.organizations.clear();
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

// Mock NotificationRepository
class MockNotificationRepository implements NotificationRepository {
  private savedBatch: Notification[] = [];

  async save(
    notification: Notification
  ): ReturnType<NotificationRepository['save']> {
    return success(notification);
  }
  async saveBatch(
    notifications: Notification[]
  ): ReturnType<NotificationRepository['saveBatch']> {
    this.savedBatch.push(...notifications);

    return success(undefined);
  }

  // Test helpers
  getSavedBatch() {
    return this.savedBatch;
  }
}

// Mock UserRepository
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

  clear(): void {
    this.superAdmins.clear();
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

describe('UnarchiveOrganizationUseCase', () => {
  let useCase: UnarchiveOrganizationUseCase;
  let organizationRepository: MockOrganizationRepository;
  let notificationRepository: MockNotificationRepository;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    organizationRepository = new MockOrganizationRepository();
    notificationRepository = new MockNotificationRepository();
    userRepository = new MockUserRepository();
    useCase = new UnarchiveOrganizationUseCase({
      ids: notificationIds,
      clock: notificationClock,
      organizationRepository,
      notificationRepository,
      userRepository,
    });
  });

  describe('when organization does not exist', () => {
    it('should return failure with NOT_FOUND error', async () => {
      const result = await useCase.execute({
        organizationId: 'non-existent-org',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('organization.errors.notFound');
      }
    });
  });

  describe('when user is not a superadmin', () => {
    beforeEach(() => {
      const orgResult = createOrganization(
        'Test Org',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = Organization.reconstitute({
          ...orgResult.value.toJSON(),
          id: 'org-1',
        });
        org.archive(organizationTestInstant);
        organizationRepository.addOrganization(org);
      }
    });

    it('should return failure with NOT_ADMIN error', async () => {
      const result = await useCase.execute({
        organizationId: 'org-1',
        adminUserId: 'regular-user',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('organization.errors.notAdmin');
      }
    });
  });

  describe('when organization is not archived', () => {
    beforeEach(() => {
      const orgResult = createOrganization(
        'Test Org',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = Organization.reconstitute({
          ...orgResult.value.toJSON(),
          id: 'org-1',
        });
        organizationRepository.addOrganization(org);
      }

      userRepository.addSuperAdmin('superadmin-1');
    });

    it('should return failure with not archived error', async () => {
      const result = await useCase.execute({
        organizationId: 'org-1',
        adminUserId: 'superadmin-1',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(
          'domain.organization.organizationNotArchived'
        );
      }
    });
  });

  describe('when superadmin unarchives successfully', () => {
    beforeEach(() => {
      const orgResult = createOrganization(
        'Test Org',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = Organization.reconstitute({
          ...orgResult.value.toJSON(),
          id: 'org-1',
        });
        org.archive(organizationTestInstant);
        organizationRepository.addOrganization(org);
      }

      userRepository.addSuperAdmin('superadmin-1');
    });

    it('should unarchive the organization', async () => {
      const result = await useCase.execute({
        organizationId: 'org-1',
        adminUserId: 'superadmin-1',
      });

      expect(result.success).toBe(true);

      const org = await organizationRepository.findById('org-1');
      expect(org).not.toBeNull();
      expect(org!.isArchived()).toBe(false);
      expect(org!.archivedAt).toBeNull();
    });

    it('should notify members of org + descendants', async () => {
      organizationRepository.setMemberUserIds('org-1', ['user-1', 'user-2']);

      const result = await useCase.execute({
        organizationId: 'org-1',
        adminUserId: 'superadmin-1',
      });

      expect(result.success).toBe(true);

      const saved = notificationRepository.getSavedBatch();
      expect(saved).toHaveLength(2);
      expect(saved[0].type).toBe('org_unarchived');
      expect(saved.map((n) => n.userId)).toEqual(
        expect.arrayContaining(['user-1', 'user-2'])
      );
    });
  });
});
