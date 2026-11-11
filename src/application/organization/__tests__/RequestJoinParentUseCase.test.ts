/** Verifies Request Join Parent behavior through application ports.
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
  parentRequestCreationInputs,
  parentRequestInstant,
} from '../../../domain/organization/__tests__/joinParentRequestTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { RequestJoinParentUseCase } from '../RequestJoinParentUseCase';
import { OrganizationErrors } from '../OrganizationErrors';
import { Organization } from '../../../domain/organization/Organization';
import { JoinParentRequest } from '../../../domain/organization/JoinParentRequest';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { JoinParentRequestRepository } from '../../../domain/organization/JoinParentRequestRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminRoles: Map<string, Set<string>> = new Map(); // orgId -> Set<userId>

  async save(org: Organization): ReturnType<OrganizationRepository['save']> {
    return org;
  }
  async findById(id: string): ReturnType<OrganizationRepository['findById']> {
    return this.organizations.get(id) || null;
  }
  async findByName(): ReturnType<OrganizationRepository['findByName']> {
    return null;
  }
  async findByCreatorId(): ReturnType<
    OrganizationRepository['findByCreatorId']
  > {
    return [];
  }
  async findByParentId(
    parentId: string
  ): ReturnType<OrganizationRepository['findByParentId']> {
    return Array.from(this.organizations.values()).filter(
      (org) => org.parentId === parentId
    );
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

  // Test helpers
  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }
  async addAdmin(
    orgId: string,
    userId: string
  ): ReturnType<OrganizationRepository['addAdmin']> {
    if (!this.adminRoles.has(orgId)) {
      this.adminRoles.set(orgId, new Set());
    }

    this.adminRoles.get(orgId)!.add(userId);
  }
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

// Mock JoinParentRequestRepository
class MockJoinParentRequestRepository implements JoinParentRequestRepository {
  private requests: Map<string, JoinParentRequest> = new Map();
  private savedRequests: JoinParentRequest[] = [];

  async save(
    request: JoinParentRequest
  ): ReturnType<JoinParentRequestRepository['save']> {
    this.savedRequests.push(request);

    return request;
  }
  async findById(
    id: string
  ): ReturnType<JoinParentRequestRepository['findById']> {
    return this.requests.get(id) || null;
  }
  async findPendingByChildOrgId(
    childOrgId: string
  ): ReturnType<JoinParentRequestRepository['findPendingByChildOrgId']> {
    for (const req of this.requests.values()) {
      if (req.childOrgId === childOrgId && req.status === 'pending') {
        return req;
      }
    }

    return null;
  }
  async findPendingByParentOrgId(): ReturnType<
    JoinParentRequestRepository['findPendingByParentOrgId']
  > {
    return [];
  }
  async findAllByChildOrgId(): ReturnType<
    JoinParentRequestRepository['findAllByChildOrgId']
  > {
    return [];
  }
  async findAllByParentOrgId(): ReturnType<
    JoinParentRequestRepository['findAllByParentOrgId']
  > {
    return [];
  }
  async update(
    request: JoinParentRequest
  ): ReturnType<JoinParentRequestRepository['update']> {
    return request;
  }
  async delete(): ReturnType<JoinParentRequestRepository['delete']> {}

  // Test helpers
  addRequest(request: JoinParentRequest) {
    this.requests.set(request.id, request);
  }
  getSavedRequests() {
    return this.savedRequests;
  }
}

// Mock UserRepository
class MockUserRepository {
  private superAdmins: Set<string> = new Set();

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
  async exists() {
    return false;
  }
  async searchUsers() {
    return [];
  }
  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }

  addSuperAdmin(userId: string) {
    this.superAdmins.add(userId);
  }
}

// Mock NotificationRepository
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

function createOrg(
  id: string,
  name: string,
  parentId: string | null = null,
  archived = false
): Organization {
  const org = Organization.reconstitute({
    id,
    name,
    description: `${name} description`,
    parentId,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: archived ? new Date() : null,
    allowMultiTreeMembership: parentId ? null : false,
  });

  return org;
}

describe('RequestJoinParentUseCase', () => {
  let useCase: RequestJoinParentUseCase;
  let orgRepo: MockOrganizationRepository;
  let joinParentRepo: MockJoinParentRequestRepository;
  let userRepo: MockUserRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    joinParentRepo = new MockJoinParentRequestRepository();
    userRepo = new MockUserRepository();

    useCase = new RequestJoinParentUseCase({
      ...parentRequestCreationInputs,
      organizationRepository: orgRepo,
      joinParentRequestRepository: joinParentRepo,
      userRepository: userRepo as unknown as UserRepository,
      notificationRepository: new MockNotificationRepository(),
    });
  });

  it('should successfully create a join parent request', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.addAdmin('child-1', 'admin-1');

    const result = await useCase.execute({
      childOrgId: 'child-1',
      parentOrgId: 'parent-1',
      adminUserId: 'admin-1',
      message: 'We want to join your organization',
    });

    expect(result.success).toBe(true);
    expect(joinParentRepo.getSavedRequests()).toHaveLength(1);
    expect(joinParentRepo.getSavedRequests()[0].id).toBe('created-request');
    expect(joinParentRepo.getSavedRequests()[0].createdAt.toISOString()).toBe(
      parentRequestInstant
    );
  });

  it('should fail if user is not admin of child org', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);

    const result = await useCase.execute({
      childOrgId: 'child-1',
      parentOrgId: 'parent-1',
      adminUserId: 'not-admin',
      message: 'We want to join',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  it('should fail if child org not found', async () => {
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(parentOrg);
    orgRepo.addAdmin('nonexistent', 'admin-1');

    const result = await useCase.execute({
      childOrgId: 'nonexistent',
      parentOrgId: 'parent-1',
      adminUserId: 'admin-1',
      message: 'We want to join',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.CHILD_ORG_NOT_FOUND);
    }
  });

  it('should fail if child org is archived', async () => {
    const childOrg = createOrg('child-1', 'Child Org', null, true);
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.addAdmin('child-1', 'admin-1');

    const result = await useCase.execute({
      childOrgId: 'child-1',
      parentOrgId: 'parent-1',
      adminUserId: 'admin-1',
      message: 'We want to join',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.CHILD_ORG_ARCHIVED);
    }
  });

  it('should fail if parent org not found', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.addAdmin('child-1', 'admin-1');

    const result = await useCase.execute({
      childOrgId: 'child-1',
      parentOrgId: 'nonexistent',
      adminUserId: 'admin-1',
      message: 'We want to join',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.PARENT_NOT_FOUND);
    }
  });

  it('should fail if parent org is archived', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    const parentOrg = createOrg('parent-1', 'Parent Org', null, true);
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.addAdmin('child-1', 'admin-1');

    const result = await useCase.execute({
      childOrgId: 'child-1',
      parentOrgId: 'parent-1',
      adminUserId: 'admin-1',
      message: 'We want to join',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.PARENT_ARCHIVED);
    }
  });

  it('should fail if same organization', async () => {
    const org = createOrg('org-1', 'Org');
    orgRepo.addOrganization(org);
    orgRepo.addAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      childOrgId: 'org-1',
      parentOrgId: 'org-1',
      adminUserId: 'admin-1',
      message: 'We want to join',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.SAME_ORGANIZATION);
    }
  });

  it('should fail if pending parent request already exists for child org', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    const parentOrg = createOrg('parent-1', 'Parent Org');
    const otherParent = createOrg('parent-2', 'Other Parent');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.addOrganization(otherParent);
    orgRepo.addAdmin('child-1', 'admin-1');

    // Existing pending request to a different parent
    const existing = JoinParentRequest.reconstitute({
      id: 'req-1',
      childOrgId: 'child-1',
      parentOrgId: 'parent-2',
      requestingAdminId: 'admin-1',
      handlingAdminId: null,
      message: 'Previous request',
      status: 'pending',
      rejectionReason: null,
      createdAt: new Date(),
      handledAt: null,
    });
    joinParentRepo.addRequest(existing);

    const result = await useCase.execute({
      childOrgId: 'child-1',
      parentOrgId: 'parent-1',
      adminUserId: 'admin-1',
      message: 'New request',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.PENDING_PARENT_REQUEST);
    }
  });

  it('should fail if parent is a descendant of child (cycle)', async () => {
    // child-1 -> grandchild-1 (grandchild is descendant of child)
    const childOrg = createOrg('child-1', 'Child Org');
    const grandchild = createOrg('grandchild-1', 'Grandchild', 'child-1');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(grandchild);
    orgRepo.addAdmin('child-1', 'admin-1');

    // Try to make child join grandchild as parent -> would create cycle
    const result = await useCase.execute({
      childOrgId: 'child-1',
      parentOrgId: 'grandchild-1',
      adminUserId: 'admin-1',
      message: 'We want to join',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.CANNOT_JOIN_OWN_DESCENDANT);
    }
  });

  it('should allow superadmin to create request even if not org admin', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    userRepo.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      childOrgId: 'child-1',
      parentOrgId: 'parent-1',
      adminUserId: 'superadmin-1',
      message: 'Superadmin request',
    });

    expect(result.success).toBe(true);
  });

  it('should allow re-parenting (org with existing parent can request to move)', async () => {
    const oldParent = createOrg('old-parent', 'Old Parent');
    const newParent = createOrg('new-parent', 'New Parent');
    const childOrg = createOrg('child-1', 'Child Org', 'old-parent');
    orgRepo.addOrganization(oldParent);
    orgRepo.addOrganization(newParent);
    orgRepo.addOrganization(childOrg);
    orgRepo.addAdmin('child-1', 'admin-1');

    const result = await useCase.execute({
      childOrgId: 'child-1',
      parentOrgId: 'new-parent',
      adminUserId: 'admin-1',
      message: 'We want to move to a new parent',
    });

    expect(result.success).toBe(true);
  });
});
