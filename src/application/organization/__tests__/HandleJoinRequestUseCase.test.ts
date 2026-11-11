/** Membership decision clients exercise authorization and pending-only transitions.
 * Typed persistence retains decision actors/times and coordinates hierarchy changes. */
import { success } from '@/domain/shared/Result';
import { PrismaMembershipStore } from '@/infrastructure/repositories/PrismaMembershipStore';
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
  organizationCreationInputs,
} from '../../../domain/organization/__tests__/organizationTestValues';
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

  async save(org: Organization): ReturnType<OrganizationRepository['save']> {
    return org;
  }
  async findById(id: string): ReturnType<OrganizationRepository['findById']> {
    return this.organizations.get(id) || null;
  }
  async findByName(
    _name: string
  ): ReturnType<OrganizationRepository['findByName']> {
    return null;
  }
  async findByCreatorId(
    _creatorId: string
  ): ReturnType<OrganizationRepository['findByCreatorId']> {
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
  async getFullTreeOrgIds(
    organizationId: string
  ): ReturnType<OrganizationRepository['getFullTreeOrgIds']> {
    const ancestorIds = await this.getAncestorIds(organizationId);
    const rootId =
      ancestorIds.length > 0
        ? ancestorIds[ancestorIds.length - 1]
        : organizationId;
    const allDescendants = await this.getDescendantIds(rootId);

    return OrganizationId.array().parse(
      [rootId, ...allDescendants].filter((id) => id !== organizationId)
    );
  }
  async isUserMember(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserMember']> {
    const userOrgs = this.memberships.get(userId);

    return userOrgs ? userOrgs.has(organizationId) : false;
  }
  async isUserAdmin(
    _userId: string,
    _organizationId: string
  ): ReturnType<OrganizationRepository['isUserAdmin']> {
    return false;
  }
  async findMembershipsByUserId(
    userId: string
  ): ReturnType<OrganizationRepository['findMembershipsByUserId']> {
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
  ): ReturnType<OrganizationRepository['findAdminOrganizationsByUserId']> {
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
    _orgId: string
  ): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    return UserId.array().parse([]);
  }
  async removeUserFromOrganization(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['removeUserFromOrganization']> {
    this.removedMemberships.push({ userId, orgId: organizationId });
    const userOrgs = this.memberships.get(userId);

    if (userOrgs) {
      userOrgs.delete(organizationId);
    }
  }
  async findPendingRequestsByUserId(
    _userId: string
  ): ReturnType<OrganizationRepository['findPendingRequestsByUserId']> {
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
  async searchByNameFuzzy(): ReturnType<
    OrganizationRepository['searchByNameFuzzy']
  > {
    return [];
  }
  async getRootAllowMultiTreeMembership(
    orgId: string
  ): ReturnType<OrganizationRepository['getRootAllowMultiTreeMembership']> {
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
    organizationRepository.isUserAdmin = async (userId, organizationId) =>
      adminRoles.get(organizationId)?.has(userId) ?? false;

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
      ...organizationCreationInputs,
      memberships: new PrismaMembershipStore(prisma as unknown as PrismaClient),
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
    const parentResult = createOrganization(
      'Parent Org',
      'Parent desc',
      'creator-1'
    );
    expect(parentResult.success).toBe(true);

    if (!parentResult.success) {
      return;
    }

    const parentOrg = Organization.reconstitute({
      ...parentResult.value.toJSON(),
      id: parentOrgId,
    });
    organizationRepository.addOrganization(parentOrg);

    const childResult = createOrganization(
      'Child Org',
      'Child desc',
      'creator-1',
      parentOrgId
    );
    expect(childResult.success).toBe(true);

    if (!childResult.success) {
      return;
    }

    const childOrg = Organization.reconstitute({
      ...childResult.value.toJSON(),
      id: childOrgId,
    });
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
    const parentResult = createOrganization(
      'Parent Org',
      'Parent desc',
      'creator-1'
    );
    expect(parentResult.success).toBe(true);

    if (!parentResult.success) {
      return;
    }

    const parentOrg = Organization.reconstitute({
      ...parentResult.value.toJSON(),
      id: parentOrgId,
    });
    organizationRepository.addOrganization(parentOrg);

    const childResult = createOrganization(
      'Child Org',
      'Child desc',
      'creator-1',
      parentOrgId
    );
    expect(childResult.success).toBe(true);

    if (!childResult.success) {
      return;
    }

    const childOrg = Organization.reconstitute({
      ...childResult.value.toJSON(),
      id: childOrgId,
    });
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
    const parentResult = createOrganization(
      'Parent Org',
      'Parent desc',
      'creator-1'
    );
    expect(parentResult.success).toBe(true);

    if (!parentResult.success) {
      return;
    }

    const parentOrg = Organization.reconstitute({
      ...parentResult.value.toJSON(),
      id: parentOrgId,
    });
    organizationRepository.addOrganization(parentOrg);

    // Set up sibling A
    const siblingAResult = createOrganization(
      'Sibling A',
      'Sibling A desc',
      'creator-1',
      parentOrgId
    );
    expect(siblingAResult.success).toBe(true);

    if (!siblingAResult.success) {
      return;
    }

    const siblingA = Organization.reconstitute({
      ...siblingAResult.value.toJSON(),
      id: siblingAId,
    });
    organizationRepository.addOrganization(siblingA);

    // Set up sibling B
    const siblingBResult = createOrganization(
      'Sibling B',
      'Sibling B desc',
      'creator-1',
      parentOrgId
    );
    expect(siblingBResult.success).toBe(true);

    if (!siblingBResult.success) {
      return;
    }

    const siblingB = Organization.reconstitute({
      ...siblingBResult.value.toJSON(),
      id: siblingBId,
    });
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
