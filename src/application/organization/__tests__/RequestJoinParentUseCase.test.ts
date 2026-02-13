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
  ): Promise<void> {}
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
}

// Mock JoinParentRequestRepository
class MockJoinParentRequestRepository implements JoinParentRequestRepository {
  private requests: Map<string, JoinParentRequest> = new Map();
  private savedRequests: JoinParentRequest[] = [];

  async save(request: JoinParentRequest): Promise<JoinParentRequest> {
    this.savedRequests.push(request);

    return request;
  }
  async findById(id: string): Promise<JoinParentRequest | null> {
    return this.requests.get(id) || null;
  }
  async findPendingByChildOrgId(
    childOrgId: string
  ): Promise<JoinParentRequest | null> {
    for (const req of this.requests.values()) {
      if (req.childOrgId === childOrgId && req.status === 'pending') {
        return req;
      }
    }

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
    return request;
  }
  async delete(): Promise<void> {}

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
