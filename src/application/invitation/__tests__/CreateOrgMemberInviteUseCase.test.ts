import { describe, it, expect, beforeEach } from 'vitest';
import { CreateOrgMemberInviteUseCase } from '../CreateOrgMemberInviteUseCase';
import { InvitationRepository } from '../../../domain/invitation/InvitationRepository';
import { Invitation } from '../../../domain/invitation/Invitation';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Organization } from '../../../domain/organization/Organization';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';
import { InvitationErrors } from '../InvitationErrors';

class MockInvitationRepository implements InvitationRepository {
  private invitations: Map<string, Invitation> = new Map();
  private idCounter = 0;

  async save(invitation: Invitation): Promise<Invitation> {
    this.idCounter++;
    const saved = Invitation.reconstitute({
      ...invitation.toJSON(),
      id: `inv-${this.idCounter}`,
    });
    this.invitations.set(saved.id, saved);

    return saved;
  }
  async update(invitation: Invitation): Promise<Invitation> {
    this.invitations.set(invitation.id, invitation);

    return invitation;
  }
  async findById(id: string): Promise<Invitation | null> {
    return this.invitations.get(id) || null;
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
  async findPendingMemberInvite(
    organizationId: string,
    inviteeId: string
  ): Promise<Invitation | null> {
    return (
      Array.from(this.invitations.values()).find(
        (inv) =>
          inv.organizationId === organizationId &&
          inv.inviteeId === inviteeId &&
          inv.type === 'member_invite' &&
          inv.isPending()
      ) || null
    );
  }

  addInvitation(invitation: Invitation): void {
    this.invitations.set(invitation.id, invitation);
  }
}

class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminRoles: Map<string, Set<string>> = new Map();
  private members: Map<string, Set<string>> = new Map();
  private treeOrgIds: string[] = [];
  private userMemberships: Map<string, Organization[]> = new Map();

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
  async getAncestorIds(): Promise<string[]> {
    return [];
  }
  async getDescendantIds(): Promise<string[]> {
    return [];
  }
  async getFullTreeOrgIds(): Promise<string[]> {
    return this.treeOrgIds;
  }
  async isUserMember(userId: string, orgId: string): Promise<boolean> {
    return this.members.get(orgId)?.has(userId) || false;
  }
  async isUserAdmin(userId: string, orgId: string): Promise<boolean> {
    return this.adminRoles.get(orgId)?.has(userId) || false;
  }
  async findMembershipsByUserId(userId: string): Promise<Organization[]> {
    return this.userMemberships.get(userId) || [];
  }
  async findAdminOrganizationsByUserId(): Promise<Organization[]> {
    return [];
  }
  async findAllWithStats(): Promise<any[]> {
    return [];
  }
  async searchOrganizationsWithStats(): Promise<any> {
    return { organizations: [], totalCount: 0 };
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
  async findAdminUserIds(): Promise<string[]> {
    return [];
  }
  async setParentId(): Promise<void> {}
  async addAdmin(): Promise<void> {}
  async removeAdmin(): Promise<void> {}
  async searchByNameFuzzy(): Promise<Array<{ id: string; name: string }>> {
    return [];
  }

  addOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
  }
  setAdmin(orgId: string, userId: string): void {
    if (!this.adminRoles.has(orgId)) {
      this.adminRoles.set(orgId, new Set());
    }

    this.adminRoles.get(orgId)!.add(userId);
  }
  addMember(orgId: string, userId: string): void {
    if (!this.members.has(orgId)) {
      this.members.set(orgId, new Set());
    }

    this.members.get(orgId)!.add(userId);
  }
  setTreeOrgIds(ids: string[]): void {
    this.treeOrgIds = ids;
  }
  addMembership(userId: string, org: Organization): void {
    if (!this.userMemberships.has(userId)) {
      this.userMemberships.set(userId, []);
    }

    this.userMemberships.get(userId)!.push(org);
  }
}

class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
  async findByIds(): Promise<User[]> {
    return [];
  }
  async findByPhoneNumber(): Promise<User | null> {
    return null;
  }
  async save(user: User): Promise<User> {
    return user;
  }
  async exists(): Promise<boolean> {
    return false;
  }
  async searchUsers(): Promise<User[]> {
    return [];
  }
  async searchUserByPhone(): Promise<User | null> {
    return null;
  }
  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
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

  addUser(user: User): void {
    this.users.set(user.id, user);
  }
  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }
}

class MockNotificationRepository implements NotificationRepository {
  async save(): Promise<any> {
    return {};
  }
  async saveBatch(): Promise<void> {}
  async findById(): Promise<any> {
    return null;
  }
  async findByUserId(): Promise<any[]> {
    return [];
  }
  async getUnreadCount(): Promise<number> {
    return 0;
  }
  async markAsRead(): Promise<void> {}
  async markAllAsRead(): Promise<void> {}
  async findByIds(): Promise<any[]> {
    return [];
  }
  async deleteByIds(): Promise<void> {}
  async getCountByUserId(): Promise<number> {
    return 0;
  }
}

function makeOrg(
  id: string,
  archived = false,
  parentId: string | null = null
): Organization {
  return Organization.reconstitute({
    id,
    name: 'Test Org',
    description: 'Test',
    parentId,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: archived ? new Date() : null,
  });
}

function makeUser(id: string): User {
  const user = User.create({
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: PhoneNumber.create('+1234567890'),
    password: 'password123',
  });
  (user as any).props.id = id;

  return user;
}

describe('CreateOrgMemberInviteUseCase', () => {
  let useCase: CreateOrgMemberInviteUseCase;
  let invitationRepo: MockInvitationRepository;
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    invitationRepo = new MockInvitationRepository();
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();
    notifRepo = new MockNotificationRepository();
    useCase = new CreateOrgMemberInviteUseCase({
      invitationRepository: invitationRepo,
      organizationRepository: orgRepo,
      userRepository: userRepo,
      notificationRepository: notifRepo,
    });
  });

  it('should fail when org not found', async () => {
    const result = await useCase.execute({
      organizationId: 'nonexistent',
      inviteeId: 'user-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.ORG_NOT_FOUND);
    }
  });

  it('should fail when org is archived', async () => {
    orgRepo.addOrganization(makeOrg('org-1', true));
    const result = await useCase.execute({
      organizationId: 'org-1',
      inviteeId: 'user-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.ORG_ARCHIVED);
    }
  });

  it('should fail when actor is not admin', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    const result = await useCase.execute({
      organizationId: 'org-1',
      inviteeId: 'user-1',
      actorUserId: 'not-admin',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.NOT_ADMIN);
    }
  });

  it('should fail when invitee not found', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    const result = await useCase.execute({
      organizationId: 'org-1',
      inviteeId: 'nonexistent',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.USER_NOT_FOUND);
    }
  });

  it('should fail when invitee is already member', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    orgRepo.addMember('org-1', 'user-1');
    userRepo.addUser(makeUser('user-1'));
    const result = await useCase.execute({
      organizationId: 'org-1',
      inviteeId: 'user-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.INVITEE_ALREADY_MEMBER);
    }
  });

  it('should fail when invitee is member of org in hierarchy', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    userRepo.addUser(makeUser('user-1'));
    const siblingOrg = makeOrg('org-sibling', false, 'parent-1');
    orgRepo.setTreeOrgIds(['parent-1', 'org-1', 'org-sibling']);
    orgRepo.addMembership('user-1', siblingOrg);
    const result = await useCase.execute({
      organizationId: 'org-1',
      inviteeId: 'user-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.INVITEE_IN_HIERARCHY);
    }
  });

  it('should fail when pending invite already exists', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    userRepo.addUser(makeUser('user-1'));
    invitationRepo.addInvitation(
      Invitation.reconstitute({
        id: 'existing-inv',
        organizationId: 'org-1',
        boardId: null,
        inviterId: 'admin-1',
        inviteeId: 'user-1',
        type: 'member_invite',
        status: 'pending',
        createdAt: new Date(),
        handledAt: null,
      })
    );
    const result = await useCase.execute({
      organizationId: 'org-1',
      inviteeId: 'user-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.ALREADY_INVITED);
    }
  });

  it('should succeed and create member_invite', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    userRepo.addUser(makeUser('user-1'));
    userRepo.addUser(makeUser('admin-1'));
    const result = await useCase.execute({
      organizationId: 'org-1',
      inviteeId: 'user-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.type).toBe('member_invite');
      expect(result.value.organizationId).toBe('org-1');
      expect(result.value.inviteeId).toBe('user-1');
      expect(result.value.status).toBe('pending');
    }
  });

  it('should succeed when superadmin invites', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    userRepo.addSuperAdmin('superadmin-1');
    userRepo.addUser(makeUser('user-1'));
    userRepo.addUser(makeUser('superadmin-1'));
    const result = await useCase.execute({
      organizationId: 'org-1',
      inviteeId: 'user-1',
      actorUserId: 'superadmin-1',
    });
    expect(result.success).toBe(true);
  });
});
