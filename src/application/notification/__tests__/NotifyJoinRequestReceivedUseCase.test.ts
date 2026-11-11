/** Verifies Notify Join Request Received behavior through application ports.
 * Notification doubles return explicit append outcomes, matching the production writer. */
import { success } from '@/domain/shared/Result';
import { ResultCount } from '@/domain/shared/Pagination';
import { OrganizationId, UserId } from '@/domain/shared/EntityIds';
import { Nickname } from '@/domain/user/Nickname';
import { notificationTestInputs } from '@/application/notification/__tests__/notificationTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyJoinRequestReceivedUseCase } from '../NotifyJoinRequestReceivedUseCase';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Notification } from '../../../domain/notification/Notification';
import { Organization } from '../../../domain/organization/Organization';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminUserIds: Map<string, string[]> = new Map();

  async save(org: Organization): Promise<Organization> {
    return org;
  }
  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }
  async findByName(): Promise<Organization | null> {
    return null;
  }
  async findByCreatorId(): Promise<Organization[]> {
    return [];
  }
  async findByParentId(): Promise<Organization[]> {
    return [];
  }
  async getAncestorIds(): ReturnType<OrganizationRepository['getAncestorIds']> {
    return [];
  }
  async getDescendantIds(): ReturnType<
    OrganizationRepository['getDescendantIds']
  > {
    return [];
  }
  async isUserMember(): Promise<boolean> {
    return false;
  }
  async isUserAdmin(): Promise<boolean> {
    return false;
  }
  async findMembershipsByUserId(): Promise<Organization[]> {
    return [];
  }
  async findAdminOrganizationsByUserId(): Promise<Organization[]> {
    return [];
  }
  async findAllWithStats(): Promise<any[]> {
    return [];
  }
  async update(org: Organization): Promise<Organization> {
    return org;
  }
  async findAcceptedMemberUserIdsIncludingDescendants(): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    return [];
  }
  async removeUserFromOrganization(): Promise<void> {}
  async findPendingRequestsByUserId(): Promise<Organization[]> {
    return [];
  }
  async getAncestors(): Promise<any[]> {
    return [];
  }
  async getChildrenWithStats(): Promise<any[]> {
    return [];
  }
  async getHierarchyTree(): Promise<any> {
    return {
      ancestors: [],
      tree: {
        id: 'org-fixture',
        name: 'Fixture organization',
        memberCount: 0,
        children: [],
      },
    };
  }
  async searchOrganizationsWithStats(): ReturnType<
    OrganizationRepository['searchOrganizationsWithStats']
  > {
    return { organizations: [], totalCount: ResultCount.parse(0) };
  }
  async setParentId(): Promise<void> {}
  async findAdminUserIds(
    organizationId: string
  ): ReturnType<OrganizationRepository['findAdminUserIds']> {
    return UserId.array().parse(this.adminUserIds.get(organizationId) || []);
  }

  async addAdmin(): Promise<void> {}
  async removeAdmin(): Promise<void> {}
  async searchByNameFuzzy(): ReturnType<
    OrganizationRepository['searchByNameFuzzy']
  > {
    return [];
  }
  async getFullTreeOrgIds(): ReturnType<
    OrganizationRepository['getFullTreeOrgIds']
  > {
    return [];
  }
  async getRootAllowMultiTreeMembership(_orgId: string): Promise<boolean> {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs(
    _orgIds: string[]
  ): ReturnType<
    OrganizationRepository['findUsersWithMultipleMembershipsInOrgs']
  > {
    return [];
  }
  async setAllowMultiTreeMembership(
    _organizationId: string,
    _value: boolean | null
  ): Promise<void> {}

  // Test helpers
  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }
  setAdminUserIds(orgId: string, userIds: string[]) {
    this.adminUserIds.set(orgId, userIds);
  }

  async isUserExactMember(
    ..._args: Parameters<OrganizationRepository['isUserExactMember']>
  ): ReturnType<OrganizationRepository['isUserExactMember']> {
    throw new Error('Unexpected test repository call: isUserExactMember');
  }
  async getAdminUserIds(
    ..._args: Parameters<OrganizationRepository['getAdminUserIds']>
  ): ReturnType<OrganizationRepository['getAdminUserIds']> {
    throw new Error('Unexpected test repository call: getAdminUserIds');
  }
  async findAcceptedMemberUserIdsForOrgs(
    ..._args: Parameters<
      OrganizationRepository['findAcceptedMemberUserIdsForOrgs']
    >
  ): ReturnType<OrganizationRepository['findAcceptedMemberUserIdsForOrgs']> {
    throw new Error(
      'Unexpected test repository call: findAcceptedMemberUserIdsForOrgs'
    );
  }
  async removeMemberFromOrganization(
    ..._args: Parameters<OrganizationRepository['removeMemberFromOrganization']>
  ): ReturnType<OrganizationRepository['removeMemberFromOrganization']> {
    throw new Error(
      'Unexpected test repository call: removeMemberFromOrganization'
    );
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

  getSavedBatch() {
    return this.savedBatch;
  }
}

// Mock UserRepository
class MockUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
  async findByIds(): Promise<User[]> {
    return [];
  }
  async findByPhoneNumber(): Promise<User | null> {
    return null;
  }
  async save(user: User): Promise<User> {
    return user;
  }
  async exists(): Promise<boolean> {
    return false;
  }
  async searchUsers(): Promise<User[]> {
    return [];
  }
  async searchUserByPhone(
    _phone: Parameters<UserRepository['searchUserByPhone']>[0]
  ): ReturnType<UserRepository['searchUserByPhone']> {
    return null;
  }
  async isSuperAdmin(): Promise<boolean> {
    return false;
  }

  // Test helper
  addUser(user: User) {
    this.users.set(user.id, user);
  }

  async findByNickname(): Promise<User | null> {
    return null;
  }

  async isNicknameAvailable(): Promise<boolean> {
    return true;
  }

  async updatePrivacySettings(): Promise<void> {}

  async confirmUser(): Promise<void> {}

  async deleteAddress(): Promise<void> {}

  async findByEmail(
    ..._args: Parameters<UserRepository['findByEmail']>
  ): ReturnType<UserRepository['findByEmail']> {
    throw new Error('Unexpected test repository call: findByEmail');
  }
}

function createOrg(id: string, name: string): Organization {
  return Organization.reconstitute({
    id,
    name,
    description: `${name} desc`,
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: false,
  });
}

function createUser(id: string, firstName: string, lastName: string): User {
  const phone = PhoneNumber.create('+79991234567');

  return User.reconstitute({
    nickname: Nickname.create('fixture_user'),
    id,
    firstName,
    lastName,
    phoneNumber: phone,
    password: 'hashed',
    language: 'ru',
    createdAt: new Date(),
  });
}

describe('NotifyJoinRequestReceivedUseCase', () => {
  let useCase: NotifyJoinRequestReceivedUseCase;
  let orgRepo: MockOrganizationRepository;
  let notifRepo: MockNotificationRepository;
  let userRepo: MockUserRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    notifRepo = new MockNotificationRepository();
    userRepo = new MockUserRepository();
    useCase = new NotifyJoinRequestReceivedUseCase({
      ...notificationTestInputs,
      organizationRepository: orgRepo,
      notificationRepository: notifRepo,
      userRepository: userRepo,
    });
  });

  it('should notify all admins of the organization', async () => {
    const org = createOrg('org-1', 'Test Org');
    const requester = createUser('user-1', 'Ivan', 'Petrov');
    orgRepo.addOrganization(org);
    userRepo.addUser(requester);
    orgRepo.setAdminUserIds('org-1', ['admin-1', 'admin-2']);

    await useCase.execute({
      organizationId: OrganizationId.parse('org-1'),
      requesterUserId: UserId.parse('user-1'),
    });

    const saved = notifRepo.getSavedBatch();
    expect(saved).toHaveLength(2);

    for (const notification of saved) {
      expect(notification.type).toBe('join_request_received');
      expect(notification.title).toBe(
        'notification.types.joinRequestReceived.title'
      );
      expect(notification.body).toBe(
        'notification.types.joinRequestReceived.body'
      );
      expect(notification.data).toEqual({
        organizationId: 'org-1',
        organizationName: 'Test Org',
        requesterName: 'Petrov Ivan',
      });
    }

    const userIds = saved.map((n) => n.userId);
    expect(userIds).toContain('admin-1');
    expect(userIds).toContain('admin-2');
  });

  it('should not create notifications when no admins', async () => {
    const org = createOrg('org-1', 'Test Org');
    const requester = createUser('user-1', 'Ivan', 'Petrov');
    orgRepo.addOrganization(org);
    userRepo.addUser(requester);
    orgRepo.setAdminUserIds('org-1', []);

    await useCase.execute({
      organizationId: OrganizationId.parse('org-1'),
      requesterUserId: UserId.parse('user-1'),
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });

  it('should handle missing organization gracefully', async () => {
    const requester = createUser('user-1', 'Ivan', 'Petrov');
    userRepo.addUser(requester);

    await useCase.execute({
      organizationId: OrganizationId.parse('nonexistent'),
      requesterUserId: UserId.parse('user-1'),
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });

  it('should handle missing requester user gracefully', async () => {
    const org = createOrg('org-1', 'Test Org');
    orgRepo.addOrganization(org);
    orgRepo.setAdminUserIds('org-1', ['admin-1']);

    await useCase.execute({
      organizationId: OrganizationId.parse('org-1'),
      requesterUserId: UserId.parse('nonexistent'),
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });
});
