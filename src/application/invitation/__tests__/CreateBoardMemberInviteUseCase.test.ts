import { describe, it, expect, beforeEach } from 'vitest';
import { CreateBoardMemberInviteUseCase } from '../CreateBoardMemberInviteUseCase';
import { InvitationRepository } from '../../../domain/invitation/InvitationRepository';
import { Invitation } from '../../../domain/invitation/Invitation';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Organization } from '../../../domain/organization/Organization';
import { Board } from '../../../domain/board/Board';
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
  async findPendingBoardMemberInvite(
    boardId: string,
    inviteeId: string
  ): Promise<Invitation | null> {
    return (
      Array.from(this.invitations.values()).find(
        (inv) =>
          inv.boardId === boardId &&
          inv.inviteeId === inviteeId &&
          inv.type === 'board_member_invite' &&
          inv.isPending()
      ) || null
    );
  }
  async findPendingMemberInvite(): Promise<Invitation | null> {
    return null;
  }

  addInvitation(invitation: Invitation): void {
    this.invitations.set(invitation.id, invitation);
  }
}

class MockBoardRepository implements BoardRepository {
  private boards: Map<string, Board> = new Map();
  private members: Map<string, Set<string>> = new Map();

  async save(board: Board): Promise<Board> {
    return board;
  }
  async findById(id: string): Promise<Board | null> {
    return this.boards.get(id) || null;
  }
  async findByOrganizationId(): Promise<Board[]> {
    return [];
  }
  async findBoardMembers(): Promise<{ userId: string }[]> {
    return [];
  }
  async isUserMember(userId: string, boardId: string): Promise<boolean> {
    return this.members.get(boardId)?.has(userId) || false;
  }
  async addUserToBoard(): Promise<void> {}
  async removeUserFromBoard(): Promise<void> {}
  async update(board: Board): Promise<Board> {
    return board;
  }

  addBoard(board: Board): void {
    this.boards.set(board.id, board);
  }
  setMember(boardId: string, userId: string): void {
    if (!this.members.has(boardId)) {
      this.members.set(boardId, new Set());
    }

    this.members.get(boardId)!.add(userId);
  }
}

class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminRoles: Map<string, Set<string>> = new Map();

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
    return [];
  }
  async isUserMember(): Promise<boolean> {
    return false;
  }
  async isUserAdmin(userId: string, orgId: string): Promise<boolean> {
    return this.adminRoles.get(orgId)?.has(userId) || false;
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

  addOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
  }
  setAdmin(orgId: string, userId: string): void {
    if (!this.adminRoles.has(orgId)) {
      this.adminRoles.set(orgId, new Set());
    }

    this.adminRoles.get(orgId)!.add(userId);
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
  async deleteAddress(): Promise<void> {}
  async getBlockedUserIds(): Promise<string[]> {
    return [];
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

function makeOrg(id: string, archived = false): Organization {
  return Organization.reconstitute({
    id,
    name: 'Test Org',
    description: 'Test',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: archived ? new Date() : null,
    allowMultiTreeMembership: false,
  });
}

function makeBoard(id: string, orgId: string, archived = false): Board {
  const result = Board.create('Test Board', orgId);

  if (!result.success) {
    throw new Error('Failed to create board');
  }

  const board = result.value;
  (board as any).props.id = id;

  if (archived) {
    board.archive();
  }

  return board;
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

describe('CreateBoardMemberInviteUseCase', () => {
  let useCase: CreateBoardMemberInviteUseCase;
  let invitationRepo: MockInvitationRepository;
  let boardRepo: MockBoardRepository;
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    invitationRepo = new MockInvitationRepository();
    boardRepo = new MockBoardRepository();
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();
    notifRepo = new MockNotificationRepository();
    useCase = new CreateBoardMemberInviteUseCase({
      invitationRepository: invitationRepo,
      boardRepository: boardRepo,
      organizationRepository: orgRepo,
      userRepository: userRepo,
      notificationRepository: notifRepo,
    });
  });

  it('should fail when board not found', async () => {
    const result = await useCase.execute({
      boardId: 'nonexistent',
      inviteeId: 'user-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.BOARD_NOT_FOUND);
    }
  });

  it('should fail when board is archived', async () => {
    boardRepo.addBoard(makeBoard('board-1', 'org-1', true));
    const result = await useCase.execute({
      boardId: 'board-1',
      inviteeId: 'user-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.BOARD_ARCHIVED);
    }
  });

  it('should fail when org not found', async () => {
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));
    const result = await useCase.execute({
      boardId: 'board-1',
      inviteeId: 'user-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.ORG_NOT_FOUND);
    }
  });

  it('should fail when org is archived', async () => {
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));
    orgRepo.addOrganization(makeOrg('org-1', true));
    const result = await useCase.execute({
      boardId: 'board-1',
      inviteeId: 'user-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.ORG_ARCHIVED);
    }
  });

  it('should fail when actor is not admin', async () => {
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));
    orgRepo.addOrganization(makeOrg('org-1'));
    const result = await useCase.execute({
      boardId: 'board-1',
      inviteeId: 'user-1',
      actorUserId: 'not-admin',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.NOT_ADMIN);
    }
  });

  it('should fail when invitee not found', async () => {
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    const result = await useCase.execute({
      boardId: 'board-1',
      inviteeId: 'nonexistent',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.USER_NOT_FOUND);
    }
  });

  it('should fail when invitee is already a board member', async () => {
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));
    boardRepo.setMember('board-1', 'user-1');
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    userRepo.addUser(makeUser('user-1'));
    const result = await useCase.execute({
      boardId: 'board-1',
      inviteeId: 'user-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.INVITEE_ALREADY_BOARD_MEMBER);
    }
  });

  it('should fail when pending invite already exists', async () => {
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    userRepo.addUser(makeUser('user-1'));
    invitationRepo.addInvitation(
      Invitation.reconstitute({
        id: 'existing-inv',
        organizationId: 'org-1',
        boardId: 'board-1',
        inviterId: 'admin-1',
        inviteeId: 'user-1',
        type: 'board_member_invite',
        status: 'pending',
        createdAt: new Date(),
        handledAt: null,
      })
    );
    const result = await useCase.execute({
      boardId: 'board-1',
      inviteeId: 'user-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.ALREADY_INVITED);
    }
  });

  it('should succeed and create invitation with type board_member_invite', async () => {
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    userRepo.addUser(makeUser('user-1'));
    userRepo.addUser(makeUser('admin-1'));
    const result = await useCase.execute({
      boardId: 'board-1',
      inviteeId: 'user-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.type).toBe('board_member_invite');
      expect(result.value.boardId).toBe('board-1');
      expect(result.value.organizationId).toBe('org-1');
      expect(result.value.inviteeId).toBe('user-1');
      expect(result.value.status).toBe('pending');
    }
  });

  it('should succeed when superadmin creates invite', async () => {
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));
    orgRepo.addOrganization(makeOrg('org-1'));
    userRepo.addSuperAdmin('superadmin-1');
    userRepo.addUser(makeUser('user-1'));
    userRepo.addUser(makeUser('superadmin-1'));
    const result = await useCase.execute({
      boardId: 'board-1',
      inviteeId: 'user-1',
      actorUserId: 'superadmin-1',
    });
    expect(result.success).toBe(true);
  });
});
