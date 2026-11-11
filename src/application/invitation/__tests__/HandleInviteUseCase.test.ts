/** Invitation decision clients exercise authorization and membership/board effects.
 * Acceptance persistence must use the injected clock in both upsert branches. */
import { success } from '@/domain/shared/Result';
import { Notification } from '@/domain/notification/Notification';
import { BoardName } from '@/domain/board/BoardName';
import { PrismaMembershipStore } from '@/infrastructure/repositories/PrismaMembershipStore';
import { UserId } from '@/domain/shared/EntityIds';
import { notificationTestInputs } from '@/application/notification/__tests__/notificationTestValues';
import { BoardId, OrganizationId } from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { Instant } from '@/domain/shared/Instant';
import { Nickname } from '@/domain/user/Nickname';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HandleInviteUseCase } from '../HandleInviteUseCase';
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
  async findPendingBoardMemberInvite(): Promise<Invitation | null> {
    return null;
  }
  async findPendingMemberInvite(): Promise<Invitation | null> {
    return null;
  }

  addInvitation(invitation: Invitation): void {
    this.invitations.set(invitation.id, invitation);
  }
}

class MockOrganizationRepository implements OrganizationRepository {
  async isUserExactMember(
    ..._args: Parameters<OrganizationRepository['isUserExactMember']>
  ): ReturnType<OrganizationRepository['isUserExactMember']> {
    throw new Error('Unexpected test repository call: isUserExactMember');
  }
  async getAdminUserIds(
    ..._args: Parameters<OrganizationRepository['getAdminUserIds']>
  ): ReturnType<OrganizationRepository['getAdminUserIds']> {
    throw new Error('Unexpected test repository call: getAdminUserIds');
  }
  async findAcceptedMemberUserIdsForOrgs(
    ..._args: Parameters<
      OrganizationRepository['findAcceptedMemberUserIdsForOrgs']
    >
  ): ReturnType<OrganizationRepository['findAcceptedMemberUserIdsForOrgs']> {
    throw new Error(
      'Unexpected test repository call: findAcceptedMemberUserIdsForOrgs'
    );
  }
  async removeMemberFromOrganization(
    ..._args: Parameters<OrganizationRepository['removeMemberFromOrganization']>
  ): ReturnType<OrganizationRepository['removeMemberFromOrganization']> {
    throw new Error(
      'Unexpected test repository call: removeMemberFromOrganization'
    );
  }
  private organizations: Map<string, Organization> = new Map();
  private adminRoles: Map<string, Set<string>> = new Map();

  addAdmin = vi.fn<(orgId: string, userId: string) => Promise<void>>();
  removeUserFromOrganization =
    vi.fn<(userId: string, orgId: string) => Promise<void>>();
  getFullTreeOrgIds = vi.fn<OrganizationRepository['getFullTreeOrgIds']>();
  findMembershipsByUserId =
    vi.fn<(userId: string) => Promise<Organization[]>>();
  findAdminUserIds = vi.fn<OrganizationRepository['findAdminUserIds']>();

  constructor() {
    this.addAdmin.mockResolvedValue(undefined);
    this.removeUserFromOrganization.mockResolvedValue(undefined);
    this.getFullTreeOrgIds.mockResolvedValue([]);
    this.findMembershipsByUserId.mockResolvedValue([]);
    this.findAdminUserIds.mockResolvedValue([]);
  }

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
  async getAncestorIds(): ReturnType<OrganizationRepository['getAncestorIds']> {
    return [];
  }
  async getDescendantIds(): ReturnType<
    OrganizationRepository['getDescendantIds']
  > {
    return [];
  }
  async isUserMember(): Promise<boolean> {
    return false;
  }
  async isUserAdmin(userId: string, orgId: string): Promise<boolean> {
    return this.adminRoles.get(orgId)?.has(userId) || false;
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
  async findAcceptedMemberUserIdsIncludingDescendants(): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    return [];
  }
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
      tree: {
        id: 'org-fixture',
        name: 'Fixture organization',
        memberCount: 0,
        children: [],
      },
    };
  }
  async setParentId(): Promise<void> {}
  async removeAdmin(): Promise<void> {}
  async searchByNameFuzzy(): ReturnType<
    OrganizationRepository['searchByNameFuzzy']
  > {
    return [];
  }
  async getRootAllowMultiTreeMembership(_orgId: string): Promise<boolean> {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs(
    _orgIds: string[]
  ): ReturnType<
    OrganizationRepository['findUsersWithMultipleMembershipsInOrgs']
  > {
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

class MockBoardRepository implements BoardRepository {
  private boards: Map<string, Board> = new Map();

  addUserToBoard =
    vi.fn<
      (userId: string, boardId: string, addedBy?: string) => Promise<void>
    >();
  isUserMember = vi.fn<(userId: string, boardId: string) => Promise<boolean>>();
  findBoardMembers = vi.fn<BoardRepository['findBoardMembers']>();

  constructor() {
    this.addUserToBoard.mockResolvedValue(undefined);
    this.isUserMember.mockResolvedValue(false);
    this.findBoardMembers.mockResolvedValue([]);
  }

  async save(board: Board): Promise<Board> {
    return board;
  }
  async findById(id: string): Promise<Board | null> {
    return this.boards.get(id) || null;
  }
  async findByOrganizationId(): Promise<Board[]> {
    return [];
  }
  async removeUserFromBoard(): Promise<void> {}
  async update(board: Board): Promise<Board> {
    return board;
  }

  async findActiveBoardsByUserId(
    _userId: string
  ): ReturnType<BoardRepository['findActiveBoardsByUserId']> {
    return [];
  }

  addBoard(board: Board): void {
    this.boards.set(board.id, board);
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

  async confirmUser(): Promise<void> {}

  async deleteAddress(): Promise<void> {}

  addUser(user: User): void {
    this.users.set(user.id, user);
  }
  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }

  async findByEmail(
    ..._args: Parameters<UserRepository['findByEmail']>
  ): ReturnType<UserRepository['findByEmail']> {
    throw new Error('Unexpected test repository call: findByEmail');
  }
}

class MockNotificationRepository implements NotificationRepository {
  private savedBatch: any[] = [];

  async save(
    notification: Notification
  ): ReturnType<NotificationRepository['save']> {
    return success(notification);
  }
  async saveBatch(
    notifications: any[]
  ): ReturnType<NotificationRepository['saveBatch']> {
    this.savedBatch.push(...notifications);

    return success(undefined);
  }

  getSavedBatch() {
    return this.savedBatch;
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

function makeBoard(id: string, orgId: string): Board {
  const result = Board.create(
    BoardName.parse('Test Board'),
    OrganizationId.parse(orgId),
    testCreation(BoardId, id)
  );

  if (!result.success) {
    throw new Error('Failed to create board');
  }

  const board = result.value;

  return board;
}

function makeUser(id: string): User {
  const user = User.reconstitute({
    ...{
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: PhoneNumber.create('+1234567890'),
      password: 'password123',
    },
    id,
    createdAt: new Date('2026-01-01'),
    language: 'en',
    nickname: Nickname.create('fixture_user'),
  });

  return user;
}

function makePendingInvitation(
  id: string,
  overrides: Partial<{
    organizationId: string;
    boardId: string | null;
    inviterId: string;
    inviteeId: string;
    type: 'admin_invite' | 'board_member_invite' | 'member_invite';
  }> = {}
): Invitation {
  return Invitation.reconstitute({
    id,
    organizationId: overrides.organizationId ?? 'org-1',
    boardId: overrides.boardId ?? null,
    inviterId: overrides.inviterId ?? 'user-1',
    inviteeId: overrides.inviteeId ?? 'user-2',
    type: overrides.type ?? 'admin_invite',
    status: 'pending',
    createdAt: new Date(),
    handledAt: null,
  });
}

const mockPrisma = {
  organizationUser: {
    create: vi.fn().mockResolvedValue({}),
    upsert: vi.fn().mockResolvedValue({}),
  },
  organizationAdminUser: {
    findUnique: vi.fn().mockResolvedValue(null),
  },
} as any;

describe('HandleInviteUseCase', () => {
  let useCase: HandleInviteUseCase;
  let invitationRepo: MockInvitationRepository;
  let orgRepo: MockOrganizationRepository;
  let boardRepo: MockBoardRepository;
  let userRepo: MockUserRepository;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    invitationRepo = new MockInvitationRepository();
    orgRepo = new MockOrganizationRepository();
    boardRepo = new MockBoardRepository();
    userRepo = new MockUserRepository();
    notifRepo = new MockNotificationRepository();
    mockPrisma.organizationUser.create.mockResolvedValue({});
    mockPrisma.organizationUser.upsert.mockResolvedValue({});
    mockPrisma.organizationAdminUser.findUnique.mockResolvedValue(null);

    useCase = new HandleInviteUseCase({
      ...notificationTestInputs,
      memberships: new PrismaMembershipStore(mockPrisma),
      invitationRepository: invitationRepo,
      organizationRepository: orgRepo,
      boardRepository: boardRepo,
      userRepository: userRepo,
      notificationRepository: notifRepo,
    });
  });

  // --- General ---

  it('should fail when invitation not found', async () => {
    const result = await useCase.execute({
      invitationId: 'nonexistent',
      action: 'accept',
      actorUserId: 'user-2',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.NOT_FOUND);
    }
  });

  it('should fail when invitation is not pending', async () => {
    const inv = Invitation.reconstitute({
      id: 'inv-1',
      organizationId: 'org-1',
      boardId: null,
      inviterId: 'user-1',
      inviteeId: 'user-2',
      type: 'admin_invite',
      status: 'accepted',
      createdAt: new Date(),
      handledAt: new Date(),
    });
    invitationRepo.addInvitation(inv);

    const result = await useCase.execute({
      invitationId: 'inv-1',
      action: 'accept',
      actorUserId: 'user-2',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.NOT_PENDING);
    }
  });

  it('should fail when actor is not the invitee', async () => {
    const inv = makePendingInvitation('inv-1', { inviteeId: 'user-2' });
    invitationRepo.addInvitation(inv);

    const result = await useCase.execute({
      invitationId: 'inv-1',
      action: 'accept',
      actorUserId: 'user-999',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.NOT_INVITEE);
    }
  });

  // --- Decline ---

  it('should decline invitation successfully', async () => {
    const inv = makePendingInvitation('inv-1', { inviteeId: 'user-2' });
    invitationRepo.addInvitation(inv);

    const result = await useCase.execute({
      invitationId: 'inv-1',
      action: 'decline',
      actorUserId: 'user-2',
    });
    expect(result.success).toBe(true);

    const updated = await invitationRepo.findById('inv-1');
    expect(updated!.status).toBe('declined');
    expect(updated!.handledAt).not.toBeNull();
  });

  it('should notify org admins when invite is declined', async () => {
    const inv = makePendingInvitation('inv-1', {
      inviteeId: 'user-2',
      organizationId: 'org-1',
      type: 'admin_invite',
    });
    invitationRepo.addInvitation(inv);

    const org = makeOrg('org-1');
    orgRepo.addOrganization(org);
    orgRepo.findAdminUserIds.mockResolvedValue([
      UserId.parse('admin-1'),
      UserId.parse('admin-2'),
    ]);

    userRepo.addUser(makeUser('user-2'));

    const result = await useCase.execute({
      invitationId: 'inv-1',
      action: 'decline',
      actorUserId: 'user-2',
    });
    expect(result.success).toBe(true);

    // Wait for fire-and-forget notification
    await new Promise((r) => setTimeout(r, 10));

    const saved = notifRepo.getSavedBatch();
    expect(saved.length).toBe(2);
    expect(saved[0].type).toBe('invite_declined');
    expect(saved[0].data).toEqual(
      expect.objectContaining({
        organizationId: 'org-1',
        organizationName: 'Test Org',
        inviteType: 'admin_invite',
      })
    );
  });

  // --- Accept admin_invite ---

  it('should accept admin invite and add user as admin', async () => {
    const inv = makePendingInvitation('inv-1', {
      inviteeId: 'user-2',
      inviterId: 'user-1',
      organizationId: 'org-1',
      type: 'admin_invite',
    });
    invitationRepo.addInvitation(inv);

    const org = makeOrg('org-1');
    orgRepo.addOrganization(org);

    userRepo.addUser(makeUser('user-2'));
    // Inviter (user-1) needs admin for AddOrgAdminUseCase auth
    orgRepo.setAdmin('org-1', 'user-1');

    const result = await useCase.execute({
      invitationId: 'inv-1',
      action: 'accept',
      actorUserId: 'user-2',
    });
    expect(result.success).toBe(true);
    expect(orgRepo.addAdmin).toHaveBeenCalledWith('org-1', 'user-2');
  });

  it('should update invitation status to accepted after admin invite', async () => {
    const inv = makePendingInvitation('inv-1', {
      inviteeId: 'user-2',
      inviterId: 'user-1',
      organizationId: 'org-1',
      type: 'admin_invite',
    });
    invitationRepo.addInvitation(inv);

    orgRepo.addOrganization(makeOrg('org-1'));
    userRepo.addUser(makeUser('user-2'));
    orgRepo.setAdmin('org-1', 'user-1');

    await useCase.execute({
      invitationId: 'inv-1',
      action: 'accept',
      actorUserId: 'user-2',
    });

    const updated = await invitationRepo.findById('inv-1');
    expect(updated!.status).toBe('accepted');
    expect(updated!.handledAt).not.toBeNull();
  });

  // --- Accept board_member_invite ---

  it('should accept board member invite and add user to board', async () => {
    const inv = makePendingInvitation('inv-1', {
      inviteeId: 'user-2',
      inviterId: 'user-1',
      organizationId: 'org-1',
      boardId: 'board-1',
      type: 'board_member_invite',
    });
    invitationRepo.addInvitation(inv);

    orgRepo.addOrganization(makeOrg('org-1'));
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));

    userRepo.addUser(makeUser('user-2'));
    // Inviter (user-1) needs admin for AddBoardMemberUseCase auth
    orgRepo.setAdmin('org-1', 'user-1');

    const result = await useCase.execute({
      invitationId: 'inv-1',
      action: 'accept',
      actorUserId: 'user-2',
    });
    expect(result.success).toBe(true);
    expect(boardRepo.addUserToBoard).toHaveBeenCalledWith(
      'user-2',
      'board-1',
      'user-1'
    );

    const updated = await invitationRepo.findById('inv-1');
    expect(updated!.status).toBe('accepted');
  });

  // --- Accept member_invite ---

  it('should accept member invite and create OrganizationUser with hierarchy cleanup', async () => {
    const inv = makePendingInvitation('inv-1', {
      inviteeId: 'user-2',
      inviterId: 'user-1',
      organizationId: 'org-1',
      type: 'member_invite',
    });
    invitationRepo.addInvitation(inv);

    orgRepo.addOrganization(makeOrg('org-1'));
    userRepo.addUser(makeUser('user-2'));

    const result = await useCase.execute({
      invitationId: 'inv-1',
      action: 'accept',
      actorUserId: 'user-2',
    });
    expect(result.success).toBe(true);

    // Verify OrganizationUser was upserted
    expect(mockPrisma.organizationUser.upsert).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: 'org-1',
          userId: 'user-2',
        },
      },
      create: expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-2',
        status: 'accepted',
        acceptedByUserId: 'user-1',
      }),
      update: expect.objectContaining({
        status: 'accepted',
        acceptedByUserId: 'user-1',
      }),
    });

    // Both upsert branches must use the supplied clock, including an existing row.
    expect(
      mockPrisma.organizationUser.upsert.mock.calls[0][0].update.acceptedAt
    ).toEqual(Instant.toDate(notificationTestInputs.clock.now()));

    // Verify hierarchy cleanup was triggered
    expect(orgRepo.getFullTreeOrgIds).toHaveBeenCalledWith('org-1');
    expect(orgRepo.findMembershipsByUserId).toHaveBeenCalledWith('user-2');

    const updated = await invitationRepo.findById('inv-1');
    expect(updated!.status).toBe('accepted');
    expect(updated!.handledAt).not.toBeNull();
  });

  it('should skip hierarchy cleanup when root org allows multi-tree membership', async () => {
    // Root org with allowMultiTreeMembership: true
    const rootOrg = Organization.reconstitute({
      id: 'root-org',
      name: 'Root Org',
      description: 'Root',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: true,
    });
    orgRepo.addOrganization(rootOrg);

    // Child org under root
    const childOrg = Organization.reconstitute({
      id: 'child-org',
      name: 'Child Org',
      description: 'Child',
      parentId: 'root-org',
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: null,
    });
    orgRepo.addOrganization(childOrg);

    // getRootAllowMultiTreeMembership returns true for child-org
    vi.spyOn(orgRepo, 'getRootAllowMultiTreeMembership').mockResolvedValue(
      true
    );

    const inv = makePendingInvitation('inv-1', {
      inviteeId: 'user-2',
      inviterId: 'user-1',
      organizationId: 'child-org',
      type: 'member_invite',
    });
    invitationRepo.addInvitation(inv);
    userRepo.addUser(makeUser('user-2'));

    const result = await useCase.execute({
      invitationId: 'inv-1',
      action: 'accept',
      actorUserId: 'user-2',
    });
    expect(result.success).toBe(true);

    // Hierarchy cleanup should NOT have been triggered
    expect(orgRepo.getFullTreeOrgIds).not.toHaveBeenCalled();
    expect(orgRepo.findMembershipsByUserId).not.toHaveBeenCalled();
    expect(orgRepo.removeUserFromOrganization).not.toHaveBeenCalled();
  });

  it('should accept member invite when user already has a pending membership (upsert)', async () => {
    const inv = makePendingInvitation('inv-1', {
      inviteeId: 'user-2',
      inviterId: 'user-1',
      organizationId: 'org-1',
      type: 'member_invite',
    });
    invitationRepo.addInvitation(inv);

    orgRepo.addOrganization(makeOrg('org-1'));
    userRepo.addUser(makeUser('user-2'));

    const result = await useCase.execute({
      invitationId: 'inv-1',
      action: 'accept',
      actorUserId: 'user-2',
    });
    expect(result.success).toBe(true);

    // Verify upsert was used (handles existing pending membership)
    expect(mockPrisma.organizationUser.upsert).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: 'org-1',
          userId: 'user-2',
        },
      },
      create: expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-2',
        status: 'accepted',
        acceptedByUserId: 'user-1',
      }),
      update: expect.objectContaining({
        status: 'accepted',
        acceptedByUserId: 'user-1',
      }),
    });
  });
});
