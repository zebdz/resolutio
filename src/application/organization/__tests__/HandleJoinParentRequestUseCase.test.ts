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
  async findByParentId(parentId: string): Promise<Organization[]> {
    return Array.from(this.organizations.values()).filter(
      (org) => org.parentId === parentId
    );
  }
  async getAncestorIds(organizationId: string): Promise<string[]> {
    const org = await this.findById(organizationId);

    if (!org || !org.parentId) {
      return [];
    }

    const ancestors: string[] = [org.parentId];
    const parentAncestors = await this.getAncestorIds(org.parentId);

    return [...ancestors, ...parentAncestors];
  }
  async getDescendantIds(organizationId: string): Promise<string[]> {
    const children = await this.findByParentId(organizationId);
    const descendants: string[] = children.map((c) => c.id);

    for (const child of children) {
      const childDescendants = await this.getDescendantIds(child.id);
      descendants.push(...childDescendants);
    }

    return descendants;
  }
  async isUserMember(): Promise<boolean> {
    return false;
  }
  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    const admins = this.adminRoles.get(organizationId);

    return admins ? admins.has(userId) : false;
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
  async findAcceptedMemberUserIdsIncludingDescendants(): Promise<string[]> {
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
      tree: { id: '', name: '', memberCount: 0, children: [] },
    };
  }
  async setParentId(
    organizationId: string,
    parentId: string | null
  ): Promise<void> {
    this.parentUpdates.push({ orgId: organizationId, parentId });
  }
  async findAdminUserIds(): Promise<string[]> {
    return [];
  }

  // Test helpers
  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }
  addAdmin(orgId: string, userId: string) {
    if (!this.adminRoles.has(orgId)) {
      this.adminRoles.set(orgId, new Set());
    }

    this.adminRoles.get(orgId)!.add(userId);
  }
  getParentUpdates() {
    return this.parentUpdates;
  }
}

// Mock JoinParentRequestRepository
class MockJoinParentRequestRepository implements JoinParentRequestRepository {
  private requests: Map<string, JoinParentRequest> = new Map();
  private updatedRequests: JoinParentRequest[] = [];

  async save(request: JoinParentRequest): Promise<JoinParentRequest> {
    return request;
  }
  async findById(id: string): Promise<JoinParentRequest | null> {
    return this.requests.get(id) || null;
  }
  async findPendingByChildOrgId(): Promise<JoinParentRequest | null> {
    return null;
  }
  async findPendingByParentOrgId(): Promise<JoinParentRequest[]> {
    return [];
  }
  async findAllByChildOrgId(): Promise<JoinParentRequest[]> {
    return [];
  }
  async findAllByParentOrgId(): Promise<JoinParentRequest[]> {
    return [];
  }
  async update(request: JoinParentRequest): Promise<JoinParentRequest> {
    this.updatedRequests.push(request);

    return request;
  }
  async delete(): Promise<void> {}

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
  async save(notification: Notification): Promise<Notification> {
    return notification;
  }
  async saveBatch(): Promise<void> {}
  async findById(): Promise<Notification | null> {
    return null;
  }
  async findByUserId(): Promise<Notification[]> {
    return [];
  }
  async getUnreadCount(): Promise<number> {
    return 0;
  }
  async markAsRead(): Promise<void> {}
  async markAllAsRead(): Promise<void> {}
  async findByIds(): Promise<Notification[]> {
    return [];
  }
  async deleteByIds(): Promise<void> {}
  async getCountByUserId(): Promise<number> {
    return 0;
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
});
