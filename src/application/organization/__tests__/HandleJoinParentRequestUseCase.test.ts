/** Verifies Handle Join Parent Request behavior through application ports.
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
import { parentRequestCreationInputs } from '../../../domain/organization/__tests__/joinParentRequestTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { HandleJoinParentRequestUseCase } from '../HandleJoinParentRequestUseCase';
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
  private adminRoles: Map<string, Set<string>> = new Map();
  private parentUpdates: Array<{ orgId: string; parentId: string | null }> = [];
  private acceptedMembers: Map<string, Set<string>> = new Map();
  private allowMultiTreeMembershipMap: Map<string, boolean | null> = new Map();
  private allowMultiTreeMembershipUpdates: Array<{
    orgId: string;
    value: boolean | null;
  }> = [];

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
  async findAcceptedMemberUserIdsIncludingDescendants(
    orgId: string
  ): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    const descendants = await this.getDescendantIds(orgId);
    const allOrgIds = [orgId, ...descendants];
    const allMembers = new Set<string>();

    for (const id of allOrgIds) {
      const members = this.acceptedMembers.get(id);

      if (members) {
        for (const m of members) {
          allMembers.add(m);
        }
      }
    }

    return UserId.array().parse(Array.from(allMembers));
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
  ): ReturnType<OrganizationRepository['setParentId']> {
    this.parentUpdates.push({ orgId: organizationId, parentId });
  }
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
  getParentUpdates() {
    return this.parentUpdates;
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
    orgId: string
  ): ReturnType<OrganizationRepository['getRootAllowMultiTreeMembership']> {
    const ancestorIds = await this.getAncestorIds(orgId);
    const rootId =
      ancestorIds.length > 0 ? ancestorIds[ancestorIds.length - 1] : orgId;

    return this.allowMultiTreeMembershipMap.get(rootId) ?? false;
  }
  async findUsersWithMultipleMembershipsInOrgs(
    _orgIds: string[]
  ): ReturnType<
    OrganizationRepository['findUsersWithMultipleMembershipsInOrgs']
  > {
    return UserId.array().parse([]);
  }
  async setAllowMultiTreeMembership(
    organizationId: string,
    value: boolean | null
  ): ReturnType<OrganizationRepository['setAllowMultiTreeMembership']> {
    this.allowMultiTreeMembershipUpdates.push({ orgId: organizationId, value });
    this.allowMultiTreeMembershipMap.set(organizationId, value);
  }

  // Test helpers
  addAcceptedMember(orgId: string, userId: string) {
    if (!this.acceptedMembers.has(orgId)) {
      this.acceptedMembers.set(orgId, new Set());
    }

    this.acceptedMembers.get(orgId)!.add(userId);
  }

  setAllowMultiTreeMembershipValue(orgId: string, value: boolean | null) {
    this.allowMultiTreeMembershipMap.set(orgId, value);
  }

  getAllowMultiTreeMembershipUpdates() {
    return this.allowMultiTreeMembershipUpdates;
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

// Mock JoinParentRequestRepository
class MockJoinParentRequestRepository implements JoinParentRequestRepository {
  private requests: Map<string, JoinParentRequest> = new Map();
  private updatedRequests: JoinParentRequest[] = [];

  async save(
    request: JoinParentRequest
  ): ReturnType<JoinParentRequestRepository['save']> {
    return request;
  }
  async findById(
    id: string
  ): ReturnType<JoinParentRequestRepository['findById']> {
    return this.requests.get(id) || null;
  }
  async findPendingByChildOrgId(): ReturnType<
    JoinParentRequestRepository['findPendingByChildOrgId']
  > {
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
    this.updatedRequests.push(request);

    return request;
  }
  async delete(): ReturnType<JoinParentRequestRepository['delete']> {}

  addRequest(request: JoinParentRequest) {
    this.requests.set(request.id, request);
  }
  getUpdatedRequests() {
    return this.updatedRequests;
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
  parentId: string | null = null
): Organization {
  return Organization.reconstitute({
    id,
    name,
    description: `${name} desc`,
    parentId,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: parentId ? null : false,
  });
}

function createPendingRequest(
  id: string,
  childOrgId: string,
  parentOrgId: string
): JoinParentRequest {
  return JoinParentRequest.reconstitute({
    id,
    childOrgId,
    parentOrgId,
    requestingAdminId: 'child-admin',
    handlingAdminId: null,
    message: 'Request message',
    status: 'pending',
    rejectionReason: null,
    createdAt: new Date(),
    handledAt: null,
  });
}

describe('HandleJoinParentRequestUseCase', () => {
  let useCase: HandleJoinParentRequestUseCase;
  let orgRepo: MockOrganizationRepository;
  let joinParentRepo: MockJoinParentRequestRepository;
  let userRepo: MockUserRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    joinParentRepo = new MockJoinParentRequestRepository();
    userRepo = new MockUserRepository();

    useCase = new HandleJoinParentRequestUseCase({
      ...parentRequestCreationInputs,
      organizationRepository: orgRepo,
      joinParentRequestRepository: joinParentRepo,
      userRepository: userRepo as unknown as UserRepository,
      notificationRepository: new MockNotificationRepository(),
    });
  });

  it('should accept request and set parentId', async () => {
    const childOrg = createOrg('child-1', 'Child');
    const parentOrg = createOrg('parent-1', 'Parent');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.addAdmin('parent-1', 'parent-admin');

    const request = createPendingRequest('req-1', 'child-1', 'parent-1');
    joinParentRepo.addRequest(request);

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'parent-admin',
      action: 'accept',
    });

    expect(result.success).toBe(true);

    // Verify parentId was set
    const parentUpdates = orgRepo.getParentUpdates();
    expect(parentUpdates).toContainEqual({
      orgId: 'child-1',
      parentId: 'parent-1',
    });

    // Verify request was updated
    const updated = joinParentRepo.getUpdatedRequests();
    expect(updated).toHaveLength(1);
    expect(updated[0].status).toBe('accepted');
    expect(updated[0].handlingAdminId).toBe('parent-admin');
  });

  it('should reject request with reason', async () => {
    const childOrg = createOrg('child-1', 'Child');
    const parentOrg = createOrg('parent-1', 'Parent');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.addAdmin('parent-1', 'parent-admin');

    const request = createPendingRequest('req-1', 'child-1', 'parent-1');
    joinParentRepo.addRequest(request);

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'parent-admin',
      action: 'reject',
      rejectionReason: 'Does not meet criteria',
    });

    expect(result.success).toBe(true);

    const updated = joinParentRepo.getUpdatedRequests();
    expect(updated).toHaveLength(1);
    expect(updated[0].status).toBe('rejected');
    expect(updated[0].rejectionReason).toBe('Does not meet criteria');

    // Verify parentId was NOT set
    expect(orgRepo.getParentUpdates()).toHaveLength(0);
  });

  it('rejects overlong reasons before persistence', async () => {
    orgRepo.addOrganization(createOrg('child-1', 'Child'));
    orgRepo.addOrganization(createOrg('parent-1', 'Parent'));
    orgRepo.addAdmin('parent-1', 'parent-admin');
    const request = createPendingRequest('req-1', 'child-1', 'parent-1');
    joinParentRepo.addRequest(request);
    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'parent-admin',
      action: 'reject',
      rejectionReason: 'x'.repeat(501),
    });
    expect(result).toEqual({
      success: false,
      error: 'domain.joinParentRequest.rejectionReasonTooLong',
    });
    expect(joinParentRepo.getUpdatedRequests()).toHaveLength(0);
    expect(request.status).toBe('pending');
  });

  it('preserves a domain refusal without persisting or notifying it', async () => {
    orgRepo.addOrganization(createOrg('child-1', 'Child'));
    orgRepo.addOrganization(createOrg('parent-1', 'Parent'));
    orgRepo.addAdmin('parent-1', 'parent-admin');
    const request = createPendingRequest('req-1', 'child-1', 'parent-1');
    joinParentRepo.addRequest(request);
    let notifications = 0;
    const notificationRepository = new MockNotificationRepository();

    notificationRepository.save = async (notification) => {
      notifications++;

      return success(notification);
    };

    const handler = new HandleJoinParentRequestUseCase({
      ...parentRequestCreationInputs,
      organizationRepository: orgRepo,
      joinParentRequestRepository: joinParentRepo,
      userRepository: userRepo as unknown as UserRepository,
      notificationRepository,
      profanityChecker: {
        containsProfanity: () => true,
        findProfaneWords: () => [],
      },
    });
    const result = await handler.execute({
      requestId: 'req-1',
      adminUserId: 'parent-admin',
      action: 'reject',
      rejectionReason: 'Refused reason',
    });
    expect(result).toEqual({
      success: false,
      error: 'domain.shared.containsProfanity',
    });
    expect(joinParentRepo.getUpdatedRequests()).toHaveLength(0);
    expect(notifications).toBe(0);
    expect(request.status).toBe('pending');
  });

  it('should fail to reject without reason', async () => {
    const childOrg = createOrg('child-1', 'Child');
    const parentOrg = createOrg('parent-1', 'Parent');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.addAdmin('parent-1', 'parent-admin');

    const request = createPendingRequest('req-1', 'child-1', 'parent-1');
    joinParentRepo.addRequest(request);

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'parent-admin',
      action: 'reject',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.REJECTION_REASON_REQUIRED);
    }
  });

  it('should fail if user is not admin of parent org', async () => {
    const childOrg = createOrg('child-1', 'Child');
    const parentOrg = createOrg('parent-1', 'Parent');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);

    const request = createPendingRequest('req-1', 'child-1', 'parent-1');
    joinParentRepo.addRequest(request);

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'not-admin',
      action: 'accept',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  it('should fail if request not found', async () => {
    const result = await useCase.execute({
      requestId: 'nonexistent',
      adminUserId: 'admin-1',
      action: 'accept',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.PARENT_REQUEST_NOT_FOUND);
    }
  });

  it('should fail if request is not pending', async () => {
    const request = JoinParentRequest.reconstitute({
      id: 'req-1',
      childOrgId: 'child-1',
      parentOrgId: 'parent-1',
      requestingAdminId: 'child-admin',
      handlingAdminId: 'other-admin',
      message: 'Request message',
      status: 'accepted',
      rejectionReason: null,
      createdAt: new Date(),
      handledAt: new Date(),
    });
    joinParentRepo.addRequest(request);
    orgRepo.addAdmin('parent-1', 'parent-admin');

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'parent-admin',
      action: 'accept',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.PARENT_REQUEST_NOT_PENDING);
    }
  });

  it('should allow superadmin to handle request', async () => {
    const childOrg = createOrg('child-1', 'Child');
    const parentOrg = createOrg('parent-1', 'Parent');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    userRepo.addSuperAdmin('superadmin-1');

    const request = createPendingRequest('req-1', 'child-1', 'parent-1');
    joinParentRepo.addRequest(request);

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'superadmin-1',
      action: 'accept',
    });

    expect(result.success).toBe(true);
  });

  it('should re-verify no cycle on accept', async () => {
    // child-1 has descendant grandchild-1
    // Request asks parent-1 to become parent of child-1
    // But by accept time, parent-1 has become descendant of child-1
    const childOrg = createOrg('child-1', 'Child');
    const parentOrg = createOrg('parent-1', 'Parent', 'child-1'); // parent is now child of child
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.addAdmin('parent-1', 'parent-admin');

    const request = createPendingRequest('req-1', 'child-1', 'parent-1');
    joinParentRepo.addRequest(request);

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'parent-admin',
      action: 'accept',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.CANNOT_JOIN_OWN_DESCENDANT);
    }
  });

  it('should block accept when trees have overlapping members and both disallow multi-membership', async () => {
    const childOrg = createOrg('child-1', 'Child');
    const parentOrg = createOrg('parent-1', 'Parent');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.addAdmin('parent-1', 'parent-admin');

    orgRepo.addAcceptedMember('child-1', 'user-1');
    orgRepo.addAcceptedMember('parent-1', 'user-1');
    orgRepo.setAllowMultiTreeMembershipValue('child-1', false);
    orgRepo.setAllowMultiTreeMembershipValue('parent-1', false);

    const request = createPendingRequest('req-1', 'child-1', 'parent-1');
    joinParentRepo.addRequest(request);

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'parent-admin',
      action: 'accept',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.MULTI_MEMBERSHIP_CONFLICT);
    }
  });

  it('should allow accept when trees have overlapping members and both allow multi-membership', async () => {
    const childOrg = createOrg('child-1', 'Child');
    const parentOrg = createOrg('parent-1', 'Parent');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.addAdmin('parent-1', 'parent-admin');

    orgRepo.addAcceptedMember('child-1', 'user-1');
    orgRepo.addAcceptedMember('parent-1', 'user-1');
    orgRepo.setAllowMultiTreeMembershipValue('child-1', true);
    orgRepo.setAllowMultiTreeMembershipValue('parent-1', true);

    const request = createPendingRequest('req-1', 'child-1', 'parent-1');
    joinParentRepo.addRequest(request);

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'parent-admin',
      action: 'accept',
    });

    expect(result.success).toBe(true);
  });

  it('should block accept when overlapping members and only parent allows multi-membership', async () => {
    const childOrg = createOrg('child-1', 'Child');
    const parentOrg = createOrg('parent-1', 'Parent');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.addAdmin('parent-1', 'parent-admin');

    orgRepo.addAcceptedMember('child-1', 'user-1');
    orgRepo.addAcceptedMember('parent-1', 'user-1');
    orgRepo.setAllowMultiTreeMembershipValue('child-1', false);
    orgRepo.setAllowMultiTreeMembershipValue('parent-1', true);

    const request = createPendingRequest('req-1', 'child-1', 'parent-1');
    joinParentRepo.addRequest(request);

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'parent-admin',
      action: 'accept',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.MULTI_MEMBERSHIP_CONFLICT);
    }
  });

  it('should allow accept when no overlapping members regardless of setting', async () => {
    const childOrg = createOrg('child-1', 'Child');
    const parentOrg = createOrg('parent-1', 'Parent');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.addAdmin('parent-1', 'parent-admin');

    orgRepo.addAcceptedMember('child-1', 'user-1');
    orgRepo.addAcceptedMember('parent-1', 'user-2');
    orgRepo.setAllowMultiTreeMembershipValue('child-1', false);
    orgRepo.setAllowMultiTreeMembershipValue('parent-1', false);

    const request = createPendingRequest('req-1', 'child-1', 'parent-1');
    joinParentRepo.addRequest(request);

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'parent-admin',
      action: 'accept',
    });

    expect(result.success).toBe(true);
  });

  it('should skip overlap check when reparenting within the same tree', async () => {
    // A (root) → B → C, user-1 is member of both A and C
    // C wants to become direct child of A — should NOT trigger overlap conflict
    const orgA = createOrg('org-a', 'Org A');
    const orgB = createOrg('org-b', 'Org B', 'org-a');
    const orgC = createOrg('org-c', 'Org C', 'org-b');
    orgRepo.addOrganization(orgA);
    orgRepo.addOrganization(orgB);
    orgRepo.addOrganization(orgC);
    orgRepo.addAdmin('org-a', 'admin-a');

    orgRepo.addAcceptedMember('org-a', 'user-1');
    orgRepo.addAcceptedMember('org-c', 'user-1');
    orgRepo.setAllowMultiTreeMembershipValue('org-a', false);

    const request = createPendingRequest('req-1', 'org-c', 'org-a');
    joinParentRepo.addRequest(request);

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'admin-a',
      action: 'accept',
    });

    expect(result.success).toBe(true);
  });
});
