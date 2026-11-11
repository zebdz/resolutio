/** Verifies Notify Join Parent Request Rejected behavior through application ports.
 * Notification doubles return explicit append outcomes, matching the production writer. */
import { success } from '@/domain/shared/Result';
import { ResultCount } from '@/domain/shared/Pagination';
import { UserId } from '@/domain/shared/EntityIds';
import { OrganizationId } from '@/domain/shared/EntityIds';
import { notificationTestInputs } from '@/application/notification/__tests__/notificationTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyJoinParentRequestRejectedUseCase } from '../NotifyJoinParentRequestRejectedUseCase';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';
import { Organization } from '../../../domain/organization/Organization';

class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private memberUserIds: Map<string, string[]> = new Map();
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
  async getFullTreeOrgIds(): ReturnType<
    OrganizationRepository['getFullTreeOrgIds']
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
  async findAcceptedMemberUserIdsIncludingDescendants(
    organizationId: string
  ): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    return UserId.array().parse(this.memberUserIds.get(organizationId) || []);
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
  setMemberUserIds(orgId: string, userIds: string[]) {
    this.memberUserIds.set(orgId, userIds);
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

describe('NotifyJoinParentRequestRejectedUseCase', () => {
  let useCase: NotifyJoinParentRequestRejectedUseCase;
  let orgRepo: MockOrganizationRepository;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    notifRepo = new MockNotificationRepository();
    useCase = new NotifyJoinParentRequestRejectedUseCase({
      ...notificationTestInputs,
      organizationRepository: orgRepo,
      notificationRepository: notifRepo,
    });
  });

  it('should create notifications for child org admins + members with rejection reason', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.setMemberUserIds('child-1', ['user-1', 'user-2']);
    orgRepo.setAdminUserIds('child-1', ['admin-1']);

    await useCase.execute({
      childOrgId: OrganizationId.parse('child-1'),
      parentOrgId: OrganizationId.parse('parent-1'),
      rejectionReason: 'Not eligible',
    });

    const saved = notifRepo.getSavedBatch();
    expect(saved).toHaveLength(3);

    for (const notification of saved) {
      expect(notification.type).toBe('join_parent_request_rejected');
      expect(notification.title).toBe(
        'notification.types.joinParentRequestRejected.title'
      );
      expect(notification.body).toBe(
        'notification.types.joinParentRequestRejected.bodyWithReason'
      );
      expect(notification.data).toEqual({
        childOrgId: 'child-1',
        parentOrgId: 'parent-1',
        childOrgName: 'Child Org',
        parentOrgName: 'Parent Org',
        rejectionReason: 'Not eligible',
      });
    }

    const userIds = saved.map((n) => n.userId);
    expect(userIds).toContain('user-1');
    expect(userIds).toContain('user-2');
    expect(userIds).toContain('admin-1');
  });

  it('should use body without reason when reason is empty', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.setMemberUserIds('child-1', ['user-1']);

    await useCase.execute({
      childOrgId: OrganizationId.parse('child-1'),
      parentOrgId: OrganizationId.parse('parent-1'),
      rejectionReason: '',
    });

    const saved = notifRepo.getSavedBatch();
    expect(saved).toHaveLength(1);
    expect(saved[0].body).toBe(
      'notification.types.joinParentRequestRejected.body'
    );
  });

  it('should handle missing child org gracefully', async () => {
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(parentOrg);

    await useCase.execute({
      childOrgId: OrganizationId.parse('nonexistent'),
      parentOrgId: OrganizationId.parse('parent-1'),
      rejectionReason: 'reason',
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });

  it('should handle missing parent org gracefully', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    orgRepo.addOrganization(childOrg);

    await useCase.execute({
      childOrgId: OrganizationId.parse('child-1'),
      parentOrgId: OrganizationId.parse('nonexistent'),
      rejectionReason: 'reason',
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });

  it('should do nothing when no recipients found', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.setMemberUserIds('child-1', []);
    orgRepo.setAdminUserIds('child-1', []);

    await useCase.execute({
      childOrgId: OrganizationId.parse('child-1'),
      parentOrgId: OrganizationId.parse('parent-1'),
      rejectionReason: 'reason',
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });

  it('should deduplicate users who are both admin and member', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.setMemberUserIds('child-1', ['user-1', 'user-2']);
    orgRepo.setAdminUserIds('child-1', ['user-1', 'admin-only']);

    await useCase.execute({
      childOrgId: OrganizationId.parse('child-1'),
      parentOrgId: OrganizationId.parse('parent-1'),
      rejectionReason: 'Not eligible',
    });

    const saved = notifRepo.getSavedBatch();
    expect(saved).toHaveLength(3);
    const userIds = saved.map((n) => n.userId);
    expect(userIds).toContain('user-1');
    expect(userIds).toContain('user-2');
    expect(userIds).toContain('admin-only');
    expect(userIds.filter((id) => id === 'user-1')).toHaveLength(1);
  });
});
