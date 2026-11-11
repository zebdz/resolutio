/** Verifies Update Organization behavior through application ports.
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
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateOrganizationUseCase } from '../UpdateOrganizationUseCase';
import { OrganizationErrors } from '../OrganizationErrors';
import { NotifyOrgNameChangedUseCase } from '../../notification/NotifyOrgNameChangedUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';

class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminRoles: Map<string, Set<string>> = new Map();
  private setAllowMultiTreeMembershipCalls: Array<{
    orgId: string;
    value: boolean | null;
  }> = [];
  private usersWithMultipleMemberships: string[] = [];

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
    for (const org of this.organizations.values()) {
      if (org.name === name) {
        return org;
      }
    }

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
  async isUserAdmin(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserAdmin']> {
    const admins = this.adminRoles.get(organizationId);

    return admins ? admins.has(userId) : false;
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
    organization: Organization
  ): ReturnType<OrganizationRepository['update']> {
    this.organizations.set(organization.id, organization);

    return organization;
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
  async findAdminUserIds(): ReturnType<
    OrganizationRepository['findAdminUserIds']
  > {
    return UserId.array().parse([]);
  }
  async setParentId(): ReturnType<OrganizationRepository['setParentId']> {}
  async addAdmin(): ReturnType<OrganizationRepository['addAdmin']> {}
  async removeAdmin(): ReturnType<OrganizationRepository['removeAdmin']> {}
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
    return UserId.array().parse(this.usersWithMultipleMemberships);
  }
  async setAllowMultiTreeMembership(
    organizationId: string,
    value: boolean | null
  ): ReturnType<OrganizationRepository['setAllowMultiTreeMembership']> {
    this.setAllowMultiTreeMembershipCalls.push({
      orgId: organizationId,
      value,
    });
  }

  // Test helpers
  addOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
  }
  setAdmin(organizationId: string, userId: string): void {
    if (!this.adminRoles.has(organizationId)) {
      this.adminRoles.set(organizationId, new Set());
    }

    this.adminRoles.get(organizationId)!.add(userId);
  }
  setUsersWithMultipleMemberships(userIds: string[]): void {
    this.usersWithMultipleMemberships = userIds;
  }
  getSetAllowMultiTreeMembershipCalls() {
    return this.setAllowMultiTreeMembershipCalls;
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

class MockNotificationRepository implements NotificationRepository {
  async save(
    notification: Notification
  ): ReturnType<NotificationRepository['save']> {
    return success(notification);
  }
  async saveBatch(): ReturnType<NotificationRepository['saveBatch']> {
    return success(undefined);
  }
}

class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();
  async findById(): ReturnType<UserRepository['findById']> {
    return null;
  }
  async findByIds(): ReturnType<UserRepository['findByIds']> {
    return [];
  }
  async findByPhoneNumber(): ReturnType<UserRepository['findByPhoneNumber']> {
    return null;
  }
  async save(user: User): ReturnType<UserRepository['save']> {
    return user;
  }
  async exists(): ReturnType<UserRepository['exists']> {
    return false;
  }
  async searchUsers(): ReturnType<UserRepository['searchUsers']> {
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

function makeOrg(
  id: string,
  name: string = 'Test Org',
  description: string = 'Test description'
): Organization {
  const org = Organization.reconstitute({
    id,
    name,
    description,
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: false,
  });

  return org;
}

function makeArchivedOrg(id: string): Organization {
  return Organization.reconstitute({
    id,
    name: 'Archived Org',
    description: 'Archived',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: new Date(),
    allowMultiTreeMembership: false,
  });
}

describe('UpdateOrganizationUseCase', () => {
  let useCase: UpdateOrganizationUseCase;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;
  let notificationRepository: MockNotificationRepository;

  beforeEach(() => {
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();
    notificationRepository = new MockNotificationRepository();
    useCase = new UpdateOrganizationUseCase({
      ids: notificationIds,
      clock: notificationClock,
      organizationRepository,
      userRepository,
      notificationRepository,
      profanityChecker: {
        containsProfanity: () => false,
        findProfaneWords: () => [],
      },
    });
  });

  it('should fail when org not found', async () => {
    const result = await useCase.execute({
      organizationId: 'nonexistent',
      userId: 'admin-1',
      name: 'New Name',
      description: 'New Desc',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notFound');
    }
  });

  it('should fail when org is archived', async () => {
    organizationRepository.addOrganization(makeArchivedOrg('org-1'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'New Name',
      description: 'New Desc',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.archived');
    }
  });

  it('should fail when user is not admin and not superadmin', async () => {
    organizationRepository.addOrganization(makeOrg('org-1'));

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'regular-user',
      name: 'New Name',
      description: 'New Desc',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notAdmin');
    }
  });

  it('should fail when name is taken by another org', async () => {
    organizationRepository.addOrganization(makeOrg('org-1', 'Original Name'));
    organizationRepository.addOrganization(makeOrg('org-2', 'Taken Name'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Taken Name',
      description: 'Desc',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.nameExists');
    }
  });

  it('should fail with domain error for empty name', async () => {
    organizationRepository.addOrganization(makeOrg('org-1'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: '',
      description: 'Desc',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('domain.organization.organizationNameEmpty');
    }
  });

  it('should fail with domain error for empty description', async () => {
    organizationRepository.addOrganization(makeOrg('org-1'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Valid Name',
      description: '',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        'domain.organization.organizationDescriptionEmpty'
      );
    }
  });

  it('should succeed when org admin updates', async () => {
    organizationRepository.addOrganization(makeOrg('org-1'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Updated Name',
      description: 'Updated Desc',
    });

    expect(result.success).toBe(true);

    const updated = await organizationRepository.findById('org-1');
    expect(updated!.name).toBe('Updated Name');
    expect(updated!.description).toBe('Updated Desc');
  });

  it('should succeed when superadmin updates', async () => {
    organizationRepository.addOrganization(makeOrg('org-1'));
    userRepository.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'superadmin-1',
      name: 'Updated Name',
      description: 'Updated Desc',
    });

    expect(result.success).toBe(true);

    const updated = await organizationRepository.findById('org-1');
    expect(updated!.name).toBe('Updated Name');
    expect(updated!.description).toBe('Updated Desc');
  });

  it('should skip uniqueness check when name is unchanged', async () => {
    organizationRepository.addOrganization(makeOrg('org-1', 'Same Name'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Same Name',
      description: 'New Desc',
    });

    expect(result.success).toBe(true);
  });

  it('should let an org keep a stored name the current rules would reject', async () => {
    // Names predating ORGANIZATION_NAME_PATTERN can contain characters the
    // pattern no longer allows. Re-validating an unchanged name would make
    // those organizations impossible to edit at all.
    const legacyName = 'Org <legacy> name';
    organizationRepository.addOrganization(makeOrg('org-1', legacyName));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: legacyName,
      description: 'New Desc',
    });

    expect(result.success).toBe(true);

    const updated = await organizationRepository.findById('org-1');
    expect(updated!.name).toBe(legacyName);
    expect(updated!.description).toBe('New Desc');
  });

  it('should still validate the name when it changes', async () => {
    organizationRepository.addOrganization(makeOrg('org-1', 'Old Name'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Renamed <bad>',
      description: 'Desc',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        'domain.organization.organizationNameInvalidChars'
      );
    }
  });

  describe('allowMultiTreeMembership toggle', () => {
    it('should allow root org to enable multi-membership', async () => {
      organizationRepository.addOrganization(makeOrg('org-1'));
      organizationRepository.setAdmin('org-1', 'admin-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'Test Org',
        description: 'Test description',
        allowMultiTreeMembership: true,
      });

      expect(result.success).toBe(true);
      expect(
        organizationRepository.getSetAllowMultiTreeMembershipCalls()
      ).toContainEqual({ orgId: 'org-1', value: true });
    });

    it('should reject toggle on child org with NOT_ROOT_ORG', async () => {
      const childOrg = Organization.reconstitute({
        id: 'org-child',
        name: 'Child Org',
        description: 'desc',
        parentId: 'org-parent',
        createdById: 'creator-1',
        createdAt: new Date(),
        archivedAt: null,
        allowMultiTreeMembership: null,
      });
      organizationRepository.addOrganization(childOrg);
      organizationRepository.setAdmin('org-child', 'admin-1');

      const result = await useCase.execute({
        organizationId: 'org-child',
        userId: 'admin-1',
        name: 'Child Org',
        description: 'desc',
        allowMultiTreeMembership: true,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(OrganizationErrors.NOT_ROOT_ORG);
      }
    });

    it('should reject disabling when users have multiple memberships', async () => {
      const rootOrg = Organization.reconstitute({
        id: 'org-1',
        name: 'Root Org',
        description: 'desc',
        parentId: null,
        createdById: 'creator-1',
        createdAt: new Date(),
        archivedAt: null,
        allowMultiTreeMembership: true,
      });
      organizationRepository.addOrganization(rootOrg);
      organizationRepository.setAdmin('org-1', 'admin-1');
      organizationRepository.setUsersWithMultipleMemberships(['user-1']);

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'Root Org',
        description: 'desc',
        allowMultiTreeMembership: false,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(
          OrganizationErrors.MULTI_MEMBERSHIP_CONFLICTS_EXIST
        );
      }
    });

    it('should allow disabling when no users have multiple memberships', async () => {
      const rootOrg = Organization.reconstitute({
        id: 'org-1',
        name: 'Root Org',
        description: 'desc',
        parentId: null,
        createdById: 'creator-1',
        createdAt: new Date(),
        archivedAt: null,
        allowMultiTreeMembership: true,
      });
      organizationRepository.addOrganization(rootOrg);
      organizationRepository.setAdmin('org-1', 'admin-1');
      organizationRepository.setUsersWithMultipleMemberships([]);

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'Root Org',
        description: 'desc',
        allowMultiTreeMembership: false,
      });

      expect(result.success).toBe(true);
      expect(
        organizationRepository.getSetAllowMultiTreeMembershipCalls()
      ).toContainEqual({ orgId: 'org-1', value: false });
    });

    it('should not call setAllowMultiTreeMembership when value unchanged', async () => {
      organizationRepository.addOrganization(makeOrg('org-1'));
      organizationRepository.setAdmin('org-1', 'admin-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'Test Org',
        description: 'Test description',
        allowMultiTreeMembership: false,
      });

      expect(result.success).toBe(true);
      expect(
        organizationRepository.getSetAllowMultiTreeMembershipCalls()
      ).toHaveLength(0);
    });

    it('should not change setting when allowMultiTreeMembership not in input', async () => {
      organizationRepository.addOrganization(makeOrg('org-1'));
      organizationRepository.setAdmin('org-1', 'admin-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'Test Org',
        description: 'Test description',
      });

      expect(result.success).toBe(true);
      expect(
        organizationRepository.getSetAllowMultiTreeMembershipCalls()
      ).toHaveLength(0);
    });
  });

  describe('org name change notification', () => {
    it('should fire notification when name changes', async () => {
      const executeSpy = vi
        .spyOn(NotifyOrgNameChangedUseCase.prototype, 'execute')
        .mockResolvedValue(success(undefined));

      organizationRepository.addOrganization(makeOrg('org-1', 'Old Name'));
      organizationRepository.setAdmin('org-1', 'admin-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'New Name',
        description: 'Test description',
      });

      expect(result.success).toBe(true);
      expect(executeSpy).toHaveBeenCalledWith({
        organizationId: 'org-1',
        oldName: 'Old Name',
        newName: 'New Name',
      });

      executeSpy.mockRestore();
    });

    it('should not fire notification when name stays the same', async () => {
      const executeSpy = vi
        .spyOn(NotifyOrgNameChangedUseCase.prototype, 'execute')
        .mockResolvedValue(success(undefined));

      organizationRepository.addOrganization(makeOrg('org-1', 'Same Name'));
      organizationRepository.setAdmin('org-1', 'admin-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'Same Name',
        description: 'New description',
      });

      expect(result.success).toBe(true);
      expect(executeSpy).not.toHaveBeenCalled();

      executeSpy.mockRestore();
    });
  });
});
