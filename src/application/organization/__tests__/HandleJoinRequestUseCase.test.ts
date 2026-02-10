import { PrismaClient } from '@/generated/prisma/client';
import { describe, it, expect, beforeEach } from 'vitest';
import { HandleJoinRequestUseCase } from '../HandleJoinRequestUseCase';
import { OrganizationErrors } from '../OrganizationErrors';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
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
      firstAdmin: { id: string; firstName: string; lastName: string } | null;
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

describe('HandleJoinRequestUseCase', () => {
  let useCase: HandleJoinRequestUseCase;
  let prisma: MockPrismaClient;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;
  let requests: Map<string, any>;
  let adminRoles: Map<string, Set<string>>;

  beforeEach(() => {
    prisma = new MockPrismaClient();
    organizationRepository = new MockOrganizationRepository();
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
});
