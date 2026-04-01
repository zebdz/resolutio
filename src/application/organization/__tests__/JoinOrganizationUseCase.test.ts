import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JoinOrganizationUseCase } from '../JoinOrganizationUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { InvitationRepository } from '../../../domain/invitation/InvitationRepository';
import { Invitation } from '../../../domain/invitation/Invitation';
import { Notification } from '../../../domain/notification/Notification';
import { OrganizationErrors } from '../OrganizationErrors';

// Mock Prisma client
class MockPrismaClient {
  public organizationUser = {
    findUnique: async (args: any): Promise<any> => {
      return null; // Default: no existing membership
    },
    create: async (args: any) => {
      return {
        organizationId: args.data.organizationId,
        userId: args.data.userId,
        status: args.data.status,
        createdAt: new Date(),
        acceptedAt: null,
      };
    },
    update: async (args: any) => {
      return {
        organizationId: args.where.organizationId_userId.organizationId,
        userId: args.where.organizationId_userId.userId,
        ...args.data,
      };
    },
  };
}

// Mock repository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private memberships: Map<string, Set<string>> = new Map(); // userId -> Set<orgId>
  private pendingRequests: Map<string, Set<string>> = new Map(); // userId -> Set<orgId>

  async save(organization: Organization): Promise<Organization> {
    (organization as any).props.id = `org-${Date.now()}`;
    this.organizations.set(organization.id, organization);

    return organization;
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }

  async findByName(name: string): Promise<Organization | null> {
    for (const org of this.organizations.values()) {
      if (org.name === name) {
        return org;
      }
    }

    return null;
  }

  async findByCreatorId(creatorId: string): Promise<Organization[]> {
    return Array.from(this.organizations.values()).filter(
      (org) => org.createdById === creatorId
    );
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
    return Array.from(this.organizations.values()).map((org) => ({
      organization: org,
      memberCount: 0,
      firstAdmin: null,
    }));
  }

  async update(organization: Organization): Promise<Organization> {
    this.organizations.set(organization.id, organization);

    return organization;
  }

  async findAcceptedMemberUserIdsIncludingDescendants(
    _organizationId: string
  ): Promise<string[]> {
    return [];
  }

  async removeUserFromOrganization(
    userId: string,
    organizationId: string
  ): Promise<void> {
    const userOrgs = this.memberships.get(userId);

    if (userOrgs) {
      userOrgs.delete(organizationId);
    }
  }

  async findPendingRequestsByUserId(userId: string): Promise<Organization[]> {
    const pendingOrgIds = this.pendingRequests.get(userId) || new Set();
    const orgs: Organization[] = [];

    for (const orgId of pendingOrgIds) {
      const org = await this.findById(orgId);

      if (org) {
        orgs.push(org);
      }
    }

    return orgs;
  }

  // Helper methods for tests
  addMembership(userId: string, organizationId: string) {
    if (!this.memberships.has(userId)) {
      this.memberships.set(userId, new Set());
    }

    this.memberships.get(userId)!.add(organizationId);
  }

  addPendingRequest(userId: string, organizationId: string) {
    if (!this.pendingRequests.has(userId)) {
      this.pendingRequests.set(userId, new Set());
    }

    this.pendingRequests.get(userId)!.add(organizationId);
  }

  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
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
  async getRootAllowMultiTreeMembership(_orgId: string): Promise<boolean> {
    return false;
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

// Mock UserRepository
class MockUserRepository implements UserRepository {
  async findById(): Promise<any> {
    return null;
  }
  async findByIds(): Promise<any[]> {
    return [];
  }
  async findByPhoneNumber(): Promise<any> {
    return null;
  }
  async save(user: any): Promise<any> {
    return user;
  }
  async exists(): Promise<boolean> {
    return false;
  }
  async searchUsers(): Promise<any[]> {
    return [];
  }
  async searchUserByPhone(_phone: string): Promise<User | null> {
    return null;
  }
  async isSuperAdmin(): Promise<boolean> {
    return false;
  }

  async findByNickname(): Promise<User | null> {
    return null;
  }

  async isNicknameAvailable(): Promise<boolean> {
    return true;
  }

  async updatePrivacySettings(): Promise<void> {}
  async isUserBlocked(): Promise<boolean> {
    return false;
  }
  async blockUser(): Promise<void> {}
  async unblockUser(): Promise<void> {}
  async confirmUser(): Promise<void> {}
  async getBlockStatus(): Promise<null> {
    return null;
  }
  async deleteAddress(): Promise<void> {}
  async getBlockedUserIds(): Promise<string[]> {
    return [];
  }
}

// Mock InvitationRepository
class MockInvitationRepository implements InvitationRepository {
  findPendingMemberInvite =
    vi.fn<(orgId: string, inviteeId: string) => Promise<Invitation | null>>();

  constructor() {
    this.findPendingMemberInvite.mockResolvedValue(null);
  }

  async save(invitation: Invitation): Promise<Invitation> {
    return invitation;
  }
  async update(invitation: Invitation): Promise<Invitation> {
    return invitation;
  }
  async findById(): Promise<Invitation | null> {
    return null;
  }
  async findPendingByInviteeId(): Promise<Invitation[]> {
    return [];
  }
  async findPendingByOrganizationId(): Promise<Invitation[]> {
    return [];
  }
  async findPendingByBoardId(): Promise<Invitation[]> {
    return [];
  }
  async findPendingAdminInvite(): Promise<Invitation | null> {
    return null;
  }
  async findPendingBoardMemberInvite(): Promise<Invitation | null> {
    return null;
  }
}

describe('JoinOrganizationUseCase', () => {
  let useCase: JoinOrganizationUseCase;
  let organizationRepository: MockOrganizationRepository;
  let notificationRepository: MockNotificationRepository;
  let userRepository: MockUserRepository;
  let invitationRepository: MockInvitationRepository;
  let prisma: MockPrismaClient;

  beforeEach(() => {
    organizationRepository = new MockOrganizationRepository();
    notificationRepository = new MockNotificationRepository();
    userRepository = new MockUserRepository();
    invitationRepository = new MockInvitationRepository();
    prisma = new MockPrismaClient();
    useCase = new JoinOrganizationUseCase({
      organizationRepository,
      notificationRepository,
      userRepository,
      invitationRepository,
      prisma: prisma as any,
    });
  });

  it('should successfully create a join request', async () => {
    const orgResult = Organization.create(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = orgResult.value;
      (org as any).props.id = 'org-123';
      organizationRepository.addOrganization(org);

      const result = await useCase.execute(
        { organizationId: 'org-123' },
        'user-456'
      );

      expect(result.success).toBe(true);
    }
  });

  it('should fail if organization does not exist', async () => {
    const result = await useCase.execute(
      { organizationId: 'non-existent-org' },
      'user-123'
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_FOUND);
    }
  });

  it('should fail if organization is archived', async () => {
    const orgResult = Organization.create(
      'Archived Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = orgResult.value;
      (org as any).props.id = 'org-archived';
      org.archive();
      organizationRepository.addOrganization(org);

      const result = await useCase.execute(
        { organizationId: 'org-archived' },
        'user-456'
      );

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(OrganizationErrors.ARCHIVED);
      }
    }
  });

  it('should fail if user is already a member', async () => {
    const orgResult = Organization.create(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = orgResult.value;
      (org as any).props.id = 'org-123';
      organizationRepository.addOrganization(org);

      prisma.organizationUser.findUnique = async () => ({
        organizationId: 'org-123',
        userId: 'user-456',
        status: 'accepted',
        createdAt: new Date(),
        acceptedAt: new Date(),
      });

      const result = await useCase.execute(
        { organizationId: 'org-123' },
        'user-456'
      );

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(OrganizationErrors.ALREADY_MEMBER);
      }
    }
  });

  it('should fail if user has a pending request', async () => {
    const orgResult = Organization.create(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = orgResult.value;
      (org as any).props.id = 'org-123';
      organizationRepository.addOrganization(org);

      prisma.organizationUser.findUnique = async () => ({
        organizationId: 'org-123',
        userId: 'user-456',
        status: 'pending',
        createdAt: new Date(),
        acceptedAt: null,
      });

      const result = await useCase.execute(
        { organizationId: 'org-123' },
        'user-456'
      );

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(OrganizationErrors.PENDING_REQUEST);
      }
    }
  });

  it('should fail if user has a pending member invite', async () => {
    const orgResult = Organization.create(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = orgResult.value;
      (org as any).props.id = 'org-123';
      organizationRepository.addOrganization(org);

      // User has a pending member invite for this org
      invitationRepository.findPendingMemberInvite.mockResolvedValueOnce(
        Invitation.reconstitute({
          id: 'inv-1',
          organizationId: 'org-123',
          boardId: null,
          inviterId: 'admin-1',
          inviteeId: 'user-456',
          type: 'member_invite',
          status: 'pending',
          createdAt: new Date(),
          handledAt: null,
        })
      );

      const result = await useCase.execute(
        { organizationId: 'org-123' },
        'user-456'
      );

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(OrganizationErrors.PENDING_INVITE);
      }
    }
  });

  it('should pass joinTokenId to create when provided', async () => {
    const orgResult = Organization.create(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = orgResult.value;
      (org as any).props.id = 'org-123';
      organizationRepository.addOrganization(org);

      const createSpy = vi.fn(prisma.organizationUser.create);
      prisma.organizationUser.create = createSpy;

      const result = await useCase.execute(
        { organizationId: 'org-123', joinTokenId: 'token-abc' },
        'user-456'
      );

      expect(result.success).toBe(true);
      expect(createSpy).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-123',
          userId: 'user-456',
          status: 'pending',
          joinTokenId: 'token-abc',
        },
      });
    }
  });

  it('should pass joinTokenId as null when not provided', async () => {
    const orgResult = Organization.create(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = orgResult.value;
      (org as any).props.id = 'org-123';
      organizationRepository.addOrganization(org);

      const createSpy = vi.fn(prisma.organizationUser.create);
      prisma.organizationUser.create = createSpy;

      const result = await useCase.execute(
        { organizationId: 'org-123' },
        'user-456'
      );

      expect(result.success).toBe(true);
      expect(createSpy).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-123',
          userId: 'user-456',
          status: 'pending',
          joinTokenId: null,
        },
      });
    }
  });

  it('should allow join request when member of parent org', async () => {
    const parentResult = Organization.create(
      'Parent Organization',
      'Parent description',
      'creator-123'
    );
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parent = parentResult.value;
      (parent as any).props.id = 'org-parent';
      organizationRepository.addOrganization(parent);

      const childResult = Organization.create(
        'Child Organization',
        'Child description',
        'creator-123',
        'org-parent'
      );
      expect(childResult.success).toBe(true);

      if (childResult.success) {
        const child = childResult.value;
        (child as any).props.id = 'org-child';
        organizationRepository.addOrganization(child);

        // User is member of parent
        organizationRepository.addMembership('user-456', 'org-parent');

        // Try to join child - should succeed now
        const result = await useCase.execute(
          { organizationId: 'org-child' },
          'user-456'
        );

        expect(result.success).toBe(true);
      }
    }
  });

  it('should allow join request when member of child org', async () => {
    const parentResult = Organization.create(
      'Parent Organization',
      'Parent description',
      'creator-123'
    );
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parent = parentResult.value;
      (parent as any).props.id = 'org-parent';
      organizationRepository.addOrganization(parent);

      const childResult = Organization.create(
        'Child Organization',
        'Child description',
        'creator-123',
        'org-parent'
      );
      expect(childResult.success).toBe(true);

      if (childResult.success) {
        const child = childResult.value;
        (child as any).props.id = 'org-child';
        organizationRepository.addOrganization(child);

        // User is member of child
        organizationRepository.addMembership('user-456', 'org-child');

        // Try to join parent - should succeed now
        const result = await useCase.execute(
          { organizationId: 'org-parent' },
          'user-456'
        );

        expect(result.success).toBe(true);
      }
    }
  });

  it('should fail if pending request in ancestor org', async () => {
    const parentResult = Organization.create(
      'Parent Organization',
      'Parent description',
      'creator-123'
    );
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parent = parentResult.value;
      (parent as any).props.id = 'org-parent';
      organizationRepository.addOrganization(parent);

      const childResult = Organization.create(
        'Child Organization',
        'Child description',
        'creator-123',
        'org-parent'
      );
      expect(childResult.success).toBe(true);

      if (childResult.success) {
        const child = childResult.value;
        (child as any).props.id = 'org-child';
        organizationRepository.addOrganization(child);

        // User has pending request in parent
        organizationRepository.addPendingRequest('user-456', 'org-parent');

        // Try to join child - should fail
        const result = await useCase.execute(
          { organizationId: 'org-child' },
          'user-456'
        );

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error).toBe(
            OrganizationErrors.PENDING_HIERARCHY_REQUEST
          );
        }
      }
    }
  });

  it('should allow re-request when previously rejected', async () => {
    const orgResult = Organization.create(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = orgResult.value;
      (org as any).props.id = 'org-123';
      organizationRepository.addOrganization(org);

      prisma.organizationUser.findUnique = async () => ({
        organizationId: 'org-123',
        userId: 'user-456',
        status: 'rejected',
        createdAt: new Date(),
        acceptedAt: null,
        rejectedAt: new Date(),
        rejectedByUserId: 'admin-1',
        rejectionReason: 'Not eligible',
      });

      const updateSpy = vi.fn(prisma.organizationUser.update);
      prisma.organizationUser.update = updateSpy;

      const result = await useCase.execute(
        { organizationId: 'org-123' },
        'user-456'
      );

      expect(result.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: 'org-123',
            userId: 'user-456',
          },
        },
        data: {
          status: 'pending',
          rejectedAt: null,
          rejectedByUserId: null,
          rejectionReason: null,
          joinTokenId: null,
        },
      });
    }
  });

  it('should check hierarchy constraints when re-requesting after rejection', async () => {
    const parentResult = Organization.create(
      'Parent Organization',
      'Parent description',
      'creator-123'
    );
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parent = parentResult.value;
      (parent as any).props.id = 'org-parent';
      organizationRepository.addOrganization(parent);

      const childResult = Organization.create(
        'Child Organization',
        'Child description',
        'creator-123',
        'org-parent'
      );
      expect(childResult.success).toBe(true);

      if (childResult.success) {
        const child = childResult.value;
        (child as any).props.id = 'org-child';
        organizationRepository.addOrganization(child);

        // User was rejected from child org
        prisma.organizationUser.findUnique = async () => ({
          organizationId: 'org-child',
          userId: 'user-456',
          status: 'rejected',
          createdAt: new Date(),
          acceptedAt: null,
          rejectedAt: new Date(),
          rejectedByUserId: 'admin-1',
          rejectionReason: null,
        });

        // User has pending request in parent
        organizationRepository.addPendingRequest('user-456', 'org-parent');

        const result = await useCase.execute(
          { organizationId: 'org-child' },
          'user-456'
        );

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error).toBe(
            OrganizationErrors.PENDING_HIERARCHY_REQUEST
          );
        }
      }
    }
  });

  it('should fail if pending request in sibling org', async () => {
    const parentResult = Organization.create(
      'Parent Organization',
      'Parent description',
      'creator-123'
    );
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parent = parentResult.value;
      (parent as any).props.id = 'org-parent';
      organizationRepository.addOrganization(parent);

      const siblingAResult = Organization.create(
        'Sibling A',
        'Sibling A description',
        'creator-123',
        'org-parent'
      );
      expect(siblingAResult.success).toBe(true);

      const siblingBResult = Organization.create(
        'Sibling B',
        'Sibling B description',
        'creator-123',
        'org-parent'
      );
      expect(siblingBResult.success).toBe(true);

      if (siblingAResult.success && siblingBResult.success) {
        const siblingA = siblingAResult.value;
        (siblingA as any).props.id = 'org-sibling-a';
        organizationRepository.addOrganization(siblingA);

        const siblingB = siblingBResult.value;
        (siblingB as any).props.id = 'org-sibling-b';
        organizationRepository.addOrganization(siblingB);

        // User has pending request in sibling A
        organizationRepository.addPendingRequest('user-456', 'org-sibling-a');

        // Try to join sibling B - should fail
        const result = await useCase.execute(
          { organizationId: 'org-sibling-b' },
          'user-456'
        );

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error).toBe(
            OrganizationErrors.PENDING_HIERARCHY_REQUEST
          );
        }
      }
    }
  });

  it('should skip hierarchy blocking when multi-tree membership allowed', async () => {
    const rootResult = Organization.create(
      'Root Organization',
      'Root description',
      'creator-123'
    );
    expect(rootResult.success).toBe(true);

    if (rootResult.success) {
      const root = rootResult.value;
      (root as any).props.id = 'org-root';
      organizationRepository.addOrganization(root);

      const childResult = Organization.create(
        'Child Organization',
        'Child description',
        'creator-123',
        'org-root'
      );
      expect(childResult.success).toBe(true);

      if (childResult.success) {
        const child = childResult.value;
        (child as any).props.id = 'org-child';
        organizationRepository.addOrganization(child);

        // User has pending request in child org
        organizationRepository.addPendingRequest('user-456', 'org-child');

        // Root allows multi-tree membership
        organizationRepository.getRootAllowMultiTreeMembership = async () =>
          true;

        // Try to join root - should succeed because multi-membership is allowed
        const result = await useCase.execute(
          { organizationId: 'org-root' },
          'user-456'
        );

        expect(result.success).toBe(true);
      }
    }
  });

  it('should fail if pending request in descendant org', async () => {
    const parentResult = Organization.create(
      'Parent Organization',
      'Parent description',
      'creator-123'
    );
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parent = parentResult.value;
      (parent as any).props.id = 'org-parent';
      organizationRepository.addOrganization(parent);

      const childResult = Organization.create(
        'Child Organization',
        'Child description',
        'creator-123',
        'org-parent'
      );
      expect(childResult.success).toBe(true);

      if (childResult.success) {
        const child = childResult.value;
        (child as any).props.id = 'org-child';
        organizationRepository.addOrganization(child);

        // User has pending request in child
        organizationRepository.addPendingRequest('user-456', 'org-child');

        // Try to join parent - should fail
        const result = await useCase.execute(
          { organizationId: 'org-parent' },
          'user-456'
        );

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error).toBe(
            OrganizationErrors.PENDING_HIERARCHY_REQUEST
          );
        }
      }
    }
  });
});
