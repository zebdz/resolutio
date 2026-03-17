import { PrismaClient } from '@/generated/prisma/client';
import { describe, it, expect, beforeEach } from 'vitest';
import { HandleJoinRequestUseCase } from '../HandleJoinRequestUseCase';
import { OrganizationErrors } from '../OrganizationErrors';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';
import { UserRepository } from '../../../domain/user/UserRepository';

// Mock PrismaClient
class MockPrismaClient {
  organizationUser = {
    findUnique: async (args: any): Promise<any> => null,

    update: async (args: any): Promise<any> => args.data,
  };
  organizationAdminUser = {
    findUnique: async (args: any): Promise<any> => null,
  };
}

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private memberships: Map<string, Set<string>> = new Map(); // userId -> Set<orgId>
  private removedMemberships: Array<{ userId: string; orgId: string }> = [];

  async save(org: Organization): Promise<Organization> {
    return org;
  }
  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }
  async findByName(_name: string): Promise<Organization | null> {
    return null;
  }
  async findByCreatorId(_creatorId: string): Promise<Organization[]> {
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
  async getFullTreeOrgIds(organizationId: string): Promise<string[]> {
    const ancestorIds = await this.getAncestorIds(organizationId);
    const rootId =
      ancestorIds.length > 0
        ? ancestorIds[ancestorIds.length - 1]
        : organizationId;
    const allDescendants = await this.getDescendantIds(rootId);

    return [rootId, ...allDescendants].filter((id) => id !== organizationId);
  }
  async isUserMember(userId: string, organizationId: string): Promise<boolean> {
    const userOrgs = this.memberships.get(userId);

    return userOrgs ? userOrgs.has(organizationId) : false;
  }
  async isUserAdmin(
    _userId: string,
    _organizationId: string
  ): Promise<boolean> {
    return false;
  }
  async findMembershipsByUserId(userId: string): Promise<Organization[]> {
    const userOrgIds = this.memberships.get(userId) || new Set();
    const orgs: Organization[] = [];

    for (const orgId of userOrgIds) {
      const org = await this.findById(orgId);

      if (org) {
        orgs.push(org);
      }
    }

    return orgs;
  }
  async findAdminOrganizationsByUserId(
    _userId: string
  ): Promise<Organization[]> {
    return [];
  }
  async findAllWithStats(): Promise<
    Array<{
      organization: Organization;
      memberCount: number;
      firstAdmin: {
        id: string;
        firstName: string;
        lastName: string;
        middleName: string | null;
      } | null;
    }>
  > {
    return [];
  }
  async update(org: Organization): Promise<Organization> {
    return org;
  }
  async findAcceptedMemberUserIdsIncludingDescendants(
    _orgId: string
  ): Promise<string[]> {
    return [];
  }
  async removeUserFromOrganization(
    userId: string,
    organizationId: string
  ): Promise<void> {
    this.removedMemberships.push({ userId, orgId: organizationId });
    const userOrgs = this.memberships.get(userId);

    if (userOrgs) {
      userOrgs.delete(organizationId);
    }
  }
  async findPendingRequestsByUserId(_userId: string): Promise<Organization[]> {
    return [];
  }

  // Test helpers
  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }

  addMembership(userId: string, organizationId: string) {
    if (!this.memberships.has(userId)) {
      this.memberships.set(userId, new Set());
    }

    this.memberships.get(userId)!.add(organizationId);
  }

  getRemovedMemberships() {
    return this.removedMemberships;
  }

  async getAncestors(): Promise<
    { id: string; name: string; memberCount: number }[]
  > {
    return [];
  }

  async getChildrenWithStats(): Promise<
    { id: string; name: string; memberCount: number }[]
  > {
    return [];
  }

  async getHierarchyTree(): Promise<{
    ancestors: { id: string; name: string; memberCount: number }[];
    tree: { id: string; name: string; memberCount: number; children: any[] };
  }> {
    return {
      ancestors: [],
      tree: { id: '', name: '', memberCount: 0, children: [] },
    };
  }
  async searchOrganizationsWithStats(): Promise<{
    organizations: any[];
    totalCount: number;
  }> {
    return { organizations: [], totalCount: 0 };
  }
  async setParentId(
    organizationId: string,
    parentId: string | null
  ): Promise<void> {}
  async findAdminUserIds(): Promise<string[]> {
    return [];
  }

  async addAdmin(): Promise<void> {}
  async removeAdmin(): Promise<void> {}
  async searchByNameFuzzy(): Promise<Array<{ id: string; name: string }>> {
    return [];
  }
  async getRootAllowMultiTreeMembership(orgId: string): Promise<boolean> {
    const org = this.organizations.get(orgId);

    if (!org) {
      return false;
    }

    if (!org.parentId) {
      return org.allowMultiTreeMembership ?? false;
    }

    return this.getRootAllowMultiTreeMembership(org.parentId);
  }
  async findUsersWithMultipleMembershipsInOrgs(
    _orgIds: string[]
  ): Promise<string[]> {
    return [];
  }
  async setAllowMultiTreeMembership(
    _organizationId: string,
    _value: boolean | null
  ): Promise<void> {}
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
  private saved: Notification[] = [];

  async save(notification: Notification): Promise<Notification> {
    this.saved.push(notification);

    return notification;
  }
  async saveBatch(notifications: Notification[]): Promise<void> {
    this.saved.push(...notifications);
  }
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

  getSaved() {
    return this.saved;
  }
}

describe('HandleJoinRequestUseCase', () => {
  let useCase: HandleJoinRequestUseCase;
  let prisma: MockPrismaClient;
  let organizationRepository: MockOrganizationRepository;
  let notificationRepository: MockNotificationRepository;
  let userRepository: MockUserRepository;
  let requests: Map<string, any>;
  let adminRoles: Map<string, Set<string>>;

  beforeEach(() => {
    prisma = new MockPrismaClient();
    organizationRepository = new MockOrganizationRepository();
    notificationRepository = new MockNotificationRepository();
    userRepository = new MockUserRepository();
    requests = new Map();
    adminRoles = new Map();

    // Override mock implementations
    prisma.organizationUser.findUnique = async (args: any) => {
      const key = `${args.where.organizationId_userId.organizationId}-${args.where.organizationId_userId.userId}`;

      return requests.get(key) || null;
    };

    prisma.organizationUser.update = async (args: any) => {
      const key = `${args.where.organizationId_userId.organizationId}-${args.where.organizationId_userId.userId}`;
      const existing = requests.get(key);

      if (!existing) {
        throw new Error('Request not found');
      }

      const updated = {
        ...existing,
        ...args.data,
      };
      requests.set(key, updated);

      return updated;
    };

    prisma.organizationAdminUser.findUnique = async (args: any) => {
      const orgId = args.where.organizationId_userId.organizationId;
      const userId = args.where.organizationId_userId.userId;
      const admins = adminRoles.get(orgId);

      return admins && admins.has(userId)
        ? { organizationId: orgId, userId }
        : null;
    };

    useCase = new HandleJoinRequestUseCase({
      prisma: prisma as unknown as PrismaClient,
      organizationRepository,
      notificationRepository,
      userRepository: userRepository as unknown as UserRepository,
    });
  });

  it('should successfully accept a pending join request', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    // Set up: admin role
    if (!adminRoles.has(organizationId)) {
      adminRoles.set(organizationId, new Set());
    }

    adminRoles.get(organizationId)!.add(adminId);

    // Set up: pending request
    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'accept',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const updated = requests.get(key);
      expect(updated.status).toBe('accepted');
      expect(updated.acceptedByUserId).toBe(adminId);
      expect(updated.acceptedAt).toBeInstanceOf(Date);
      expect(updated.rejectedAt).toBeNull();
      expect(updated.rejectionReason).toBeNull();
    }
  });

  it('should successfully reject a pending join request with reason', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';
    const rejectionReason = 'Does not meet requirements';

    // Set up: admin role
    if (!adminRoles.has(organizationId)) {
      adminRoles.set(organizationId, new Set());
    }

    adminRoles.get(organizationId)!.add(adminId);

    // Set up: pending request
    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'reject',
      rejectionReason,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const updated = requests.get(key);
      expect(updated.status).toBe('rejected');
      expect(updated.rejectedByUserId).toBe(adminId);
      expect(updated.rejectedAt).toBeInstanceOf(Date);
      expect(updated.rejectionReason).toBe(rejectionReason);
      expect(updated.acceptedAt).toBeNull();
      expect(updated.acceptedByUserId).toBeNull();
    }
  });

  it('should reject a pending join request without reason', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    // Set up: admin role
    if (!adminRoles.has(organizationId)) {
      adminRoles.set(organizationId, new Set());
    }

    adminRoles.get(organizationId)!.add(adminId);

    // Set up: pending request
    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'reject',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const updated = requests.get(key);
      expect(updated.status).toBe('rejected');
      expect(updated.rejectedByUserId).toBe(adminId);
      expect(updated.rejectedAt).toBeInstanceOf(Date);
      expect(updated.rejectionReason).toBeNull();
    }
  });

  it('should fail if admin is not an admin of the organization', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'not-admin-789';

    // Set up: pending request (no admin role)
    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'accept',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  it('should fail if join request does not exist', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    // Set up: admin role (but no request)
    if (!adminRoles.has(organizationId)) {
      adminRoles.set(organizationId, new Set());
    }

    adminRoles.get(organizationId)!.add(adminId);

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'accept',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.REQUEST_NOT_FOUND);
    }
  });

  it('should fail if join request is not pending', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    // Set up: admin role
    if (!adminRoles.has(organizationId)) {
      adminRoles.set(organizationId, new Set());
    }

    adminRoles.get(organizationId)!.add(adminId);

    // Set up: already accepted request
    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'accepted',
      createdAt: new Date(),
      acceptedAt: new Date(),
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: 'other-admin',
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'accept',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_PENDING);
    }
  });

  it('should remove user from parent org membership when accepting into child org', async () => {
    const parentOrgId = 'org-parent';
    const childOrgId = 'org-child';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    // Set up organizations in hierarchy
    const parentResult = Organization.create(
      'Parent Org',
      'Parent desc',
      'creator-1'
    );
    expect(parentResult.success).toBe(true);

    if (!parentResult.success) {
      return;
    }

    const parentOrg = parentResult.value;
    (parentOrg as any).props.id = parentOrgId;
    organizationRepository.addOrganization(parentOrg);

    const childResult = Organization.create(
      'Child Org',
      'Child desc',
      'creator-1',
      parentOrgId
    );
    expect(childResult.success).toBe(true);

    if (!childResult.success) {
      return;
    }

    const childOrg = childResult.value;
    (childOrg as any).props.id = childOrgId;
    organizationRepository.addOrganization(childOrg);

    // User is accepted member of parent org
    organizationRepository.addMembership(requesterId, parentOrgId);

    // Set up: admin role for child org
    adminRoles.set(childOrgId, new Set([adminId]));

    // Set up: pending request to join child org
    const key = `${childOrgId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId: childOrgId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId: childOrgId,
      requesterId,
      adminId,
      action: 'accept',
    });

    expect(result.success).toBe(true);

    // Verify user was removed from parent org
    const removed = organizationRepository.getRemovedMemberships();
    expect(removed).toContainEqual({ userId: requesterId, orgId: parentOrgId });
  });

  it('should remove user from child org membership when accepting into parent org', async () => {
    const parentOrgId = 'org-parent';
    const childOrgId = 'org-child';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    // Set up organizations in hierarchy
    const parentResult = Organization.create(
      'Parent Org',
      'Parent desc',
      'creator-1'
    );
    expect(parentResult.success).toBe(true);

    if (!parentResult.success) {
      return;
    }

    const parentOrg = parentResult.value;
    (parentOrg as any).props.id = parentOrgId;
    organizationRepository.addOrganization(parentOrg);

    const childResult = Organization.create(
      'Child Org',
      'Child desc',
      'creator-1',
      parentOrgId
    );
    expect(childResult.success).toBe(true);

    if (!childResult.success) {
      return;
    }

    const childOrg = childResult.value;
    (childOrg as any).props.id = childOrgId;
    organizationRepository.addOrganization(childOrg);

    // User is accepted member of child org
    organizationRepository.addMembership(requesterId, childOrgId);

    // Set up: admin role for parent org
    adminRoles.set(parentOrgId, new Set([adminId]));

    // Set up: pending request to join parent org
    const key = `${parentOrgId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId: parentOrgId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId: parentOrgId,
      requesterId,
      adminId,
      action: 'accept',
    });

    expect(result.success).toBe(true);

    // Verify user was removed from child org
    const removed = organizationRepository.getRemovedMemberships();
    expect(removed).toContainEqual({ userId: requesterId, orgId: childOrgId });
  });

  it('should remove user from sibling org membership when accepting into sibling org', async () => {
    const parentOrgId = 'org-parent';
    const siblingAId = 'org-sibling-a';
    const siblingBId = 'org-sibling-b';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    // Set up parent
    const parentResult = Organization.create(
      'Parent Org',
      'Parent desc',
      'creator-1'
    );
    expect(parentResult.success).toBe(true);

    if (!parentResult.success) {
      return;
    }

    const parentOrg = parentResult.value;
    (parentOrg as any).props.id = parentOrgId;
    organizationRepository.addOrganization(parentOrg);

    // Set up sibling A
    const siblingAResult = Organization.create(
      'Sibling A',
      'Sibling A desc',
      'creator-1',
      parentOrgId
    );
    expect(siblingAResult.success).toBe(true);

    if (!siblingAResult.success) {
      return;
    }

    const siblingA = siblingAResult.value;
    (siblingA as any).props.id = siblingAId;
    organizationRepository.addOrganization(siblingA);

    // Set up sibling B
    const siblingBResult = Organization.create(
      'Sibling B',
      'Sibling B desc',
      'creator-1',
      parentOrgId
    );
    expect(siblingBResult.success).toBe(true);

    if (!siblingBResult.success) {
      return;
    }

    const siblingB = siblingBResult.value;
    (siblingB as any).props.id = siblingBId;
    organizationRepository.addOrganization(siblingB);

    // User is accepted member of sibling A
    organizationRepository.addMembership(requesterId, siblingAId);

    // Set up: admin role for sibling B
    adminRoles.set(siblingBId, new Set([adminId]));

    // Set up: pending request to join sibling B
    const key = `${siblingBId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId: siblingBId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId: siblingBId,
      requesterId,
      adminId,
      action: 'accept',
    });

    expect(result.success).toBe(true);

    // Verify user was removed from sibling A
    const removed = organizationRepository.getRemovedMemberships();
    expect(removed).toContainEqual({ userId: requesterId, orgId: siblingAId });
  });

  it('should allow superadmin to accept request even if not org admin', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const superadminId = 'superadmin-1';

    userRepository.addSuperAdmin(superadminId);

    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId: superadminId,
      action: 'accept',
    });

    expect(result.success).toBe(true);
  });

  it('should allow superadmin to reject request even if not org admin', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const superadminId = 'superadmin-1';

    userRepository.addSuperAdmin(superadminId);

    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId: superadminId,
      action: 'reject',
      rejectionReason: 'Superadmin decision',
    });

    expect(result.success).toBe(true);
  });

  it('should send accepted notification when accepting a request', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    const org = Organization.reconstitute({
      id: organizationId,
      name: 'Test Org',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: false,
    });
    organizationRepository.addOrganization(org);

    adminRoles.set(organizationId, new Set([adminId]));

    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'accept',
    });

    // Wait for fire-and-forget notification
    await new Promise((r) => setTimeout(r, 50));

    const saved = notificationRepository.getSaved();
    expect(saved).toHaveLength(1);
    expect(saved[0].type).toBe('join_request_accepted');
    expect(saved[0].userId).toBe(requesterId);
    expect(saved[0].data).toEqual({
      organizationId,
      organizationName: 'Test Org',
    });
  });

  it('should send rejected notification when rejecting a request', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    const org = Organization.reconstitute({
      id: organizationId,
      name: 'Test Org',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: false,
    });
    organizationRepository.addOrganization(org);

    adminRoles.set(organizationId, new Set([adminId]));

    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'reject',
      rejectionReason: 'Not qualified',
    });

    // Wait for fire-and-forget notification
    await new Promise((r) => setTimeout(r, 50));

    const saved = notificationRepository.getSaved();
    expect(saved).toHaveLength(1);
    expect(saved[0].type).toBe('join_request_rejected');
    expect(saved[0].userId).toBe(requesterId);
    expect(saved[0].data).toEqual({
      organizationId,
      organizationName: 'Test Org',
      rejectionReason: 'Not qualified',
    });
  });

  it('should not send notification when silent is true', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    const org = Organization.reconstitute({
      id: organizationId,
      name: 'Test Org',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: false,
    });
    organizationRepository.addOrganization(org);

    adminRoles.set(organizationId, new Set([adminId]));

    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'accept',
      silent: true,
    });

    // Wait to ensure no fire-and-forget notification
    await new Promise((r) => setTimeout(r, 50));

    expect(notificationRepository.getSaved()).toHaveLength(0);
  });

  it('should skip hierarchy removal when tree allows multi-membership', async () => {
    const parentOrgId = 'org-parent';
    const childOrgId = 'org-child';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    const parentOrg = Organization.reconstitute({
      id: parentOrgId,
      name: 'Parent Org',
      description: 'Parent desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: true,
    });
    organizationRepository.addOrganization(parentOrg);

    const childOrg = Organization.reconstitute({
      id: childOrgId,
      name: 'Child Org',
      description: 'Child desc',
      parentId: parentOrgId,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: null,
    });
    organizationRepository.addOrganization(childOrg);

    organizationRepository.addMembership(requesterId, parentOrgId);

    adminRoles.set(childOrgId, new Set([adminId]));

    const key = `${childOrgId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId: childOrgId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId: childOrgId,
      requesterId,
      adminId,
      action: 'accept',
    });

    expect(result.success).toBe(true);

    // User should NOT have been removed from parent
    const removed = organizationRepository.getRemovedMemberships();
    expect(removed).toHaveLength(0);
  });
});
