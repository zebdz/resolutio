/** Verifies Notify Join Request Rejected behavior through application ports.
 * Notification doubles return explicit append outcomes, matching the production writer. */
import { success } from '@/domain/shared/Result';
import { ResultCount } from '@/domain/shared/Pagination';
import { OrganizationId, UserId } from '@/domain/shared/EntityIds';
import { notificationTestInputs } from '@/application/notification/__tests__/notificationTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyJoinRequestRejectedUseCase } from '../NotifyJoinRequestRejectedUseCase';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';
import { Organization } from '../../../domain/organization/Organization';

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();

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
  async findAdminUserIds(): ReturnType<
    OrganizationRepository['findAdminUserIds']
  > {
    return [];
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
  private saved: Notification[] = [];

  async save(
    notification: Notification
  ): ReturnType<NotificationRepository['save']> {
    this.saved.push(notification);

    return success(notification);
  }
  async saveBatch(
    notifications: Notification[]
  ): ReturnType<NotificationRepository['saveBatch']> {
    this.saved.push(...notifications);

    return success(undefined);
  }

  getSaved() {
    return this.saved;
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

describe('NotifyJoinRequestRejectedUseCase', () => {
  let useCase: NotifyJoinRequestRejectedUseCase;
  let orgRepo: MockOrganizationRepository;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    notifRepo = new MockNotificationRepository();
    useCase = new NotifyJoinRequestRejectedUseCase({
      ...notificationTestInputs,
      organizationRepository: orgRepo,
      notificationRepository: notifRepo,
    });
  });

  it('should create notification with rejection reason', async () => {
    const org = createOrg('org-1', 'Test Org');
    orgRepo.addOrganization(org);

    await useCase.execute({
      organizationId: OrganizationId.parse('org-1'),
      requesterUserId: UserId.parse('user-1'),
      rejectionReason: 'Insufficient documentation',
    });

    const saved = notifRepo.getSaved();
    expect(saved).toHaveLength(1);

    const notification = saved[0];
    expect(notification.userId).toBe('user-1');
    expect(notification.type).toBe('join_request_rejected');
    expect(notification.title).toBe(
      'notification.types.joinRequestRejected.title'
    );
    expect(notification.body).toBe(
      'notification.types.joinRequestRejected.bodyWithReason'
    );
    expect(notification.data).toEqual({
      organizationId: 'org-1',
      organizationName: 'Test Org',
      rejectionReason: 'Insufficient documentation',
    });
  });

  it('should use body without reason when rejection reason is empty', async () => {
    const org = createOrg('org-1', 'Test Org');
    orgRepo.addOrganization(org);

    await useCase.execute({
      organizationId: OrganizationId.parse('org-1'),
      requesterUserId: UserId.parse('user-1'),
      rejectionReason: '',
    });

    const saved = notifRepo.getSaved();
    expect(saved).toHaveLength(1);
    expect(saved[0].body).toBe('notification.types.joinRequestRejected.body');
    expect(saved[0].data).toEqual({
      organizationId: 'org-1',
      organizationName: 'Test Org',
      rejectionReason: '',
    });
  });

  it('should handle missing organization gracefully', async () => {
    await useCase.execute({
      organizationId: OrganizationId.parse('nonexistent'),
      requesterUserId: UserId.parse('user-1'),
      rejectionReason: 'reason',
    });

    expect(notifRepo.getSaved()).toHaveLength(0);
  });
});
