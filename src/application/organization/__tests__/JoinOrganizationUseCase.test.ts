/** Membership request clients exercise authorization, renewal and notification flow.
 * Typed store mapping retains explicit request times and rejection clearing. */
import { success } from '@/domain/shared/Result';
import { Instant } from '@/domain/shared/Instant';
import { PrismaClient } from '@/generated/prisma/client';
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
  organizationTestInstant,
} from '../../../domain/organization/__tests__/organizationTestValues';
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

  async save(
    organization: Organization
  ): ReturnType<OrganizationRepository['save']> {
    this.organizations.set(organization.id, organization);

    return organization;
  }

  async findById(id: string): ReturnType<OrganizationRepository['findById']> {
    return this.organizations.get(id) || null;
  }

  async findByName(
    name: string
  ): ReturnType<OrganizationRepository['findByName']> {
    for (const org of this.organizations.values()) {
      if (org.name === name) {
        return org;
      }
    }

    return null;
  }

  async findByCreatorId(
    creatorId: string
  ): ReturnType<OrganizationRepository['findByCreatorId']> {
    return Array.from(this.organizations.values()).filter(
      (org) => org.createdById === creatorId
    );
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
    return Array.from(this.organizations.values()).map((org) => ({
      organization: org,
      memberCount: MemberCount.parse(0),
      firstAdmin: null,
      parentOrg: null,
    }));
  }

  async update(
    organization: Organization
  ): ReturnType<OrganizationRepository['update']> {
    this.organizations.set(organization.id, organization);

    return organization;
  }

  async findAcceptedMemberUserIdsIncludingDescendants(
    _organizationId: string
  ): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    return UserId.array().parse([]);
  }

  async removeUserFromOrganization(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['removeUserFromOrganization']> {
    const userOrgs = this.memberships.get(userId);

    if (userOrgs) {
      userOrgs.delete(organizationId);
    }
  }

  async findPendingRequestsByUserId(
    userId: string
  ): ReturnType<OrganizationRepository['findPendingRequestsByUserId']> {
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

// Mock UserRepository
class MockUserRepository implements UserRepository {
  async findById(): ReturnType<UserRepository['findById']> {
    return null;
  }
  async findByIds(): ReturnType<UserRepository['findByIds']> {
    return [];
  }
  async findByPhoneNumber(): ReturnType<UserRepository['findByPhoneNumber']> {
    return null;
  }
  async save(user: any): ReturnType<UserRepository['save']> {
    return user;
  }
  async exists(): ReturnType<UserRepository['exists']> {
    return false;
  }
  async searchUsers(): ReturnType<UserRepository['searchUsers']> {
    return [];
  }
  async searchUserByPhone(
    _phone: Parameters<UserRepository['searchUserByPhone']>[0]
  ): ReturnType<UserRepository['searchUserByPhone']> {
    return null;
  }
  async isSuperAdmin(): ReturnType<UserRepository['isSuperAdmin']> {
    return false;
  }

  async findByNickname(): ReturnType<UserRepository['findByNickname']> {
    return null;
  }

  async isNicknameAvailable(): ReturnType<
    UserRepository['isNicknameAvailable']
  > {
    return true;
  }

  async updatePrivacySettings(): ReturnType<
    UserRepository['updatePrivacySettings']
  > {}

  async confirmUser(): ReturnType<UserRepository['confirmUser']> {}

  async deleteAddress(): ReturnType<UserRepository['deleteAddress']> {}

  async findByEmail(
    ..._args: Parameters<UserRepository['findByEmail']>
  ): ReturnType<UserRepository['findByEmail']> {
    throw new Error('Unexpected findByEmail in this test');
  }
}

// Mock InvitationRepository
class MockInvitationRepository implements InvitationRepository {
  findPendingMemberInvite =
    vi.fn<(orgId: string, inviteeId: string) => Promise<Invitation | null>>();

  constructor() {
    this.findPendingMemberInvite.mockResolvedValue(null);
  }

  async save(invitation: Invitation): ReturnType<InvitationRepository['save']> {
    return invitation;
  }
  async update(
    invitation: Invitation
  ): ReturnType<InvitationRepository['update']> {
    return invitation;
  }
  async findById(): ReturnType<InvitationRepository['findById']> {
    return null;
  }
  async findPendingByInviteeId(): ReturnType<
    InvitationRepository['findPendingByInviteeId']
  > {
    return [];
  }
  async findPendingByOrganizationId(): ReturnType<
    InvitationRepository['findPendingByOrganizationId']
  > {
    return [];
  }
  async findPendingByBoardId(): ReturnType<
    InvitationRepository['findPendingByBoardId']
  > {
    return [];
  }
  async findPendingAdminInvite(): ReturnType<
    InvitationRepository['findPendingAdminInvite']
  > {
    return null;
  }
  async findPendingBoardMemberInvite(): ReturnType<
    InvitationRepository['findPendingBoardMemberInvite']
  > {
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
      ids: notificationIds,
      clock: notificationClock,
      organizationRepository,
      notificationRepository,
      userRepository,
      invitationRepository,
      memberships: new PrismaMembershipStore(prisma as unknown as PrismaClient),
    });
  });

  it('should successfully create a join request', async () => {
    const orgResult = createOrganization(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = Organization.reconstitute({
        ...orgResult.value.toJSON(),
        id: 'org-123',
      });
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
    const orgResult = createOrganization(
      'Archived Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = Organization.reconstitute({
        ...orgResult.value.toJSON(),
        id: 'org-archived',
      });
      org.archive(organizationTestInstant);
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
    const orgResult = createOrganization(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = Organization.reconstitute({
        ...orgResult.value.toJSON(),
        id: 'org-123',
      });
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
    const orgResult = createOrganization(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = Organization.reconstitute({
        ...orgResult.value.toJSON(),
        id: 'org-123',
      });
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
    const orgResult = createOrganization(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = Organization.reconstitute({
        ...orgResult.value.toJSON(),
        id: 'org-123',
      });
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
    const orgResult = createOrganization(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = Organization.reconstitute({
        ...orgResult.value.toJSON(),
        id: 'org-123',
      });
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
          createdAt: Instant.toDate(notificationClock.now()),
          joinTokenId: 'token-abc',
        },
      });
    }
  });

  it('should pass joinTokenId as null when not provided', async () => {
    const orgResult = createOrganization(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = Organization.reconstitute({
        ...orgResult.value.toJSON(),
        id: 'org-123',
      });
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
          createdAt: Instant.toDate(notificationClock.now()),
          joinTokenId: null,
        },
      });
    }
  });

  it('should allow join request when member of parent org', async () => {
    const parentResult = createOrganization(
      'Parent Organization',
      'Parent description',
      'creator-123'
    );
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parent = Organization.reconstitute({
        ...parentResult.value.toJSON(),
        id: 'org-parent',
      });
      organizationRepository.addOrganization(parent);

      const childResult = createOrganization(
        'Child Organization',
        'Child description',
        'creator-123',
        'org-parent'
      );
      expect(childResult.success).toBe(true);

      if (childResult.success) {
        const child = Organization.reconstitute({
          ...childResult.value.toJSON(),
          id: 'org-child',
        });
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
    const parentResult = createOrganization(
      'Parent Organization',
      'Parent description',
      'creator-123'
    );
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parent = Organization.reconstitute({
        ...parentResult.value.toJSON(),
        id: 'org-parent',
      });
      organizationRepository.addOrganization(parent);

      const childResult = createOrganization(
        'Child Organization',
        'Child description',
        'creator-123',
        'org-parent'
      );
      expect(childResult.success).toBe(true);

      if (childResult.success) {
        const child = Organization.reconstitute({
          ...childResult.value.toJSON(),
          id: 'org-child',
        });
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
    const parentResult = createOrganization(
      'Parent Organization',
      'Parent description',
      'creator-123'
    );
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parent = Organization.reconstitute({
        ...parentResult.value.toJSON(),
        id: 'org-parent',
      });
      organizationRepository.addOrganization(parent);

      const childResult = createOrganization(
        'Child Organization',
        'Child description',
        'creator-123',
        'org-parent'
      );
      expect(childResult.success).toBe(true);

      if (childResult.success) {
        const child = Organization.reconstitute({
          ...childResult.value.toJSON(),
          id: 'org-child',
        });
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
    const orgResult = createOrganization(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = Organization.reconstitute({
        ...orgResult.value.toJSON(),
        id: 'org-123',
      });
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
    const parentResult = createOrganization(
      'Parent Organization',
      'Parent description',
      'creator-123'
    );
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parent = Organization.reconstitute({
        ...parentResult.value.toJSON(),
        id: 'org-parent',
      });
      organizationRepository.addOrganization(parent);

      const childResult = createOrganization(
        'Child Organization',
        'Child description',
        'creator-123',
        'org-parent'
      );
      expect(childResult.success).toBe(true);

      if (childResult.success) {
        const child = Organization.reconstitute({
          ...childResult.value.toJSON(),
          id: 'org-child',
        });
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
    const parentResult = createOrganization(
      'Parent Organization',
      'Parent description',
      'creator-123'
    );
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parent = Organization.reconstitute({
        ...parentResult.value.toJSON(),
        id: 'org-parent',
      });
      organizationRepository.addOrganization(parent);

      const siblingAResult = createOrganization(
        'Sibling A',
        'Sibling A description',
        'creator-123',
        'org-parent'
      );
      expect(siblingAResult.success).toBe(true);

      const siblingBResult = createOrganization(
        'Sibling B',
        'Sibling B description',
        'creator-123',
        'org-parent'
      );
      expect(siblingBResult.success).toBe(true);

      if (siblingAResult.success && siblingBResult.success) {
        const siblingA = Organization.reconstitute({
          ...siblingAResult.value.toJSON(),
          id: 'org-sibling-a',
        });
        organizationRepository.addOrganization(siblingA);

        const siblingB = Organization.reconstitute({
          ...siblingBResult.value.toJSON(),
          id: 'org-sibling-b',
        });
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
    const rootResult = createOrganization(
      'Root Organization',
      'Root description',
      'creator-123'
    );
    expect(rootResult.success).toBe(true);

    if (rootResult.success) {
      const root = Organization.reconstitute({
        ...rootResult.value.toJSON(),
        id: 'org-root',
      });
      organizationRepository.addOrganization(root);

      const childResult = createOrganization(
        'Child Organization',
        'Child description',
        'creator-123',
        'org-root'
      );
      expect(childResult.success).toBe(true);

      if (childResult.success) {
        const child = Organization.reconstitute({
          ...childResult.value.toJSON(),
          id: 'org-child',
        });
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
    const parentResult = createOrganization(
      'Parent Organization',
      'Parent description',
      'creator-123'
    );
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parent = Organization.reconstitute({
        ...parentResult.value.toJSON(),
        id: 'org-parent',
      });
      organizationRepository.addOrganization(parent);

      const childResult = createOrganization(
        'Child Organization',
        'Child description',
        'creator-123',
        'org-parent'
      );
      expect(childResult.success).toBe(true);

      if (childResult.success) {
        const child = Organization.reconstitute({
          ...childResult.value.toJSON(),
          id: 'org-child',
        });
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
