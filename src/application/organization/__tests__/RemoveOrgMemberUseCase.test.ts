import { describe, it, expect, beforeEach } from 'vitest';
import { RemoveOrgMemberUseCase } from '../RemoveOrgMemberUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { Board } from '../../../domain/board/Board';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';
import { LastAdminError } from '../../../domain/organization/LastAdminError';

type RemovalRecord = {
  organizationId: string;
  userId: string;
  removedByUserId: string;
  reason: string;
};

class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminRoles: Map<string, Set<string>> = new Map();
  private members: Map<string, Set<string>> = new Map();
  public removals: RemovalRecord[] = [];

  async save(org: Organization): Promise<Organization> {
    this.organizations.set(org.id, org);

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
  async isUserExactMember(
    userId: string,
    organizationId: string
  ): Promise<boolean> {
    const members = this.members.get(organizationId);

    return members ? members.has(userId) : false;
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
  async searchOrganizationsWithStats(): Promise<any> {
    return { organizations: [], totalCount: 0 };
  }
  async update(org: Organization): Promise<Organization> {
    return org;
  }
  async findAcceptedMemberUserIdsIncludingDescendants(): Promise<string[]> {
    return [];
  }
  async findAcceptedMemberUserIdsForOrgs(): Promise<string[]> {
    return [];
  }
  async removeUserFromOrganization(): Promise<void> {}
  async removeMemberFromOrganization(
    organizationId: string,
    userId: string,
    removedByUserId: string,
    reason: string
  ): Promise<void> {
    this.members.get(organizationId)?.delete(userId);
    this.removals.push({ organizationId, userId, removedByUserId, reason });
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
      tree: { id: '', name: '', memberCount: 0, children: [] },
    };
  }
  async findAdminUserIds(organizationId: string): Promise<string[]> {
    const admins = this.adminRoles.get(organizationId);

    return admins ? Array.from(admins) : [];
  }
  async setParentId(): Promise<void> {}
  async addAdmin(organizationId: string, userId: string): Promise<void> {
    if (!this.adminRoles.has(organizationId)) {
      this.adminRoles.set(organizationId, new Set());
    }

    this.adminRoles.get(organizationId)!.add(userId);
  }
  async removeAdmin(organizationId: string, userId: string): Promise<void> {
    const admins = this.adminRoles.get(organizationId);

    if (admins && admins.size <= 1) {
      throw new LastAdminError();
    }

    admins?.delete(userId);
  }
  async searchByNameFuzzy(): Promise<Array<{ id: string; name: string }>> {
    return [];
  }
  async getRootAllowMultiTreeMembership(): Promise<boolean> {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs(): Promise<string[]> {
    return [];
  }
  async setAllowMultiTreeMembership(): Promise<void> {}

  // Test helpers
  addOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
  }
  setAdmin(organizationId: string, userId: string): void {
    if (!this.adminRoles.has(organizationId)) {
      this.adminRoles.set(organizationId, new Set());
    }

    this.adminRoles.get(organizationId)!.add(userId);
  }
  addMember(organizationId: string, userId: string): void {
    if (!this.members.has(organizationId)) {
      this.members.set(organizationId, new Set());
    }

    this.members.get(organizationId)!.add(userId);
  }
}

type BoardRemovalRecord = {
  userId: string;
  boardId: string;
  removedBy?: string;
  removedReason?: string;
};

class MockBoardRepository implements BoardRepository {
  private boards: Map<string, Board> = new Map();
  private members: Map<string, Set<string>> = new Map();
  public removals: BoardRemovalRecord[] = [];

  async save(board: Board): Promise<Board> {
    this.boards.set(board.id, board);

    return board;
  }
  async findById(id: string): Promise<Board | null> {
    return this.boards.get(id) || null;
  }
  async findByOrganizationId(organizationId: string): Promise<Board[]> {
    return Array.from(this.boards.values()).filter(
      (b) => b.organizationId === organizationId
    );
  }
  async findBoardMembers(boardId: string): Promise<{ userId: string }[]> {
    const members = this.members.get(boardId);

    return members ? Array.from(members).map((userId) => ({ userId })) : [];
  }
  async isUserMember(userId: string, boardId: string): Promise<boolean> {
    const members = this.members.get(boardId);

    return members ? members.has(userId) : false;
  }
  async addUserToBoard(userId: string, boardId: string): Promise<void> {
    if (!this.members.has(boardId)) {
      this.members.set(boardId, new Set());
    }

    this.members.get(boardId)!.add(userId);
  }
  async removeUserFromBoard(
    userId: string,
    boardId: string,
    removedBy?: string,
    removedReason?: string
  ): Promise<void> {
    this.members.get(boardId)?.delete(userId);
    this.removals.push({ userId, boardId, removedBy, removedReason });
  }
  async update(board: Board): Promise<Board> {
    this.boards.set(board.id, board);

    return board;
  }
  async findActiveBoardsByUserId(): Promise<
    Array<{ id: string; name: string; organizationId: string }>
  > {
    return [];
  }

  // Test helpers
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

  // Test helper
  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }
}

class MockNotificationRepository implements NotificationRepository {
  private saved: Notification | null = null;
  public failNext = false;

  async save(notification: Notification): Promise<Notification> {
    if (this.failNext) {
      throw new Error('save failed');
    }

    this.saved = notification;

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

  getSaved() {
    return this.saved;
  }
}

function makeOrg(id: string): Organization {
  return Organization.reconstitute({
    id,
    name: 'Test Org',
    description: 'Test',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: false,
  });
}

function makeArchivedOrg(id: string): Organization {
  return Organization.reconstitute({
    id,
    name: 'Archived',
    description: 'Archived',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: new Date(),
    allowMultiTreeMembership: false,
  });
}

function makeBoard(
  id: string,
  organizationId: string,
  archived = false
): Board {
  return Board.reconstitute({
    id,
    name: `Board ${id}`,
    organizationId,
    createdAt: new Date(),
    archivedAt: archived ? new Date() : null,
  });
}

describe('RemoveOrgMemberUseCase', () => {
  let useCase: RemoveOrgMemberUseCase;
  let orgRepo: MockOrganizationRepository;
  let boardRepo: MockBoardRepository;
  let userRepo: MockUserRepository;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    boardRepo = new MockBoardRepository();
    userRepo = new MockUserRepository();
    notifRepo = new MockNotificationRepository();
    useCase = new RemoveOrgMemberUseCase({
      organizationRepository: orgRepo,
      boardRepository: boardRepo,
      userRepository: userRepo,
      notificationRepository: notifRepo,
    });
  });

  function setupHappyPath() {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.addMember('org-1', 'member-1');
    userRepo.addSuperAdmin('superadmin-1');
  }

  it('fails with reasonRequired when reason is empty or whitespace', async () => {
    setupHappyPath();

    for (const reason of ['', '   ', '\n\t']) {
      const result = await useCase.execute({
        organizationId: 'org-1',
        targetUserId: 'member-1',
        actorUserId: 'superadmin-1',
        reason,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('organization.errors.reasonRequired');
      }
    }
  });

  it('fails when org not found', async () => {
    userRepo.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      organizationId: 'nonexistent',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notFound');
    }
  });

  it('fails when org is archived', async () => {
    orgRepo.addOrganization(makeArchivedOrg('org-1'));
    orgRepo.addMember('org-1', 'member-1');
    userRepo.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.archived');
    }
  });

  it('fails when actor is not a superadmin', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.addMember('org-1', 'member-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'random-user',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notAdmin');
    }
  });

  it('fails when actor is an org admin but not a superadmin (superadmin-only for now)', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.addMember('org-1', 'member-1');
    orgRepo.setAdmin('org-1', 'org-admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'org-admin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notAdmin');
    }
  });

  it('fails when superadmin tries to remove self', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.addMember('org-1', 'superadmin-1');
    userRepo.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'superadmin-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.cannotRemoveSelf');
    }
  });

  it('fails when target is not an accepted member of this exact org', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    userRepo.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'not-a-member',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notMember');
    }
  });

  it('fails with lastAdmin when target is the last org admin', async () => {
    setupHappyPath();
    orgRepo.setAdmin('org-1', 'member-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('domain.organization.lastAdmin');
    }

    // Membership must remain intact
    expect(await orgRepo.isUserExactMember('member-1', 'org-1')).toBe(true);
    expect(orgRepo.removals).toHaveLength(0);
    expect(boardRepo.removals).toHaveLength(0);
  });

  it('maps the repository concurrency guard (LastAdminError) to the last-admin code', async () => {
    // Domain pre-check passes (2 admins), but a concurrent removal makes the
    // repository's transactional recount throw — the use case must surface it
    // as the same last-admin code, not crash.
    setupHappyPath();
    orgRepo.setAdmin('org-1', 'member-1');
    orgRepo.setAdmin('org-1', 'other-admin');

    orgRepo.removeAdmin = async () => {
      throw new LastAdminError();
    };

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('domain.organization.lastAdmin');
    }

    // Removal aborted before the membership delete
    expect(await orgRepo.isUserExactMember('member-1', 'org-1')).toBe(true);
    expect(orgRepo.removals).toHaveLength(0);
  });

  it('removes admin role first when target is an admin (2+ admins)', async () => {
    setupHappyPath();
    orgRepo.setAdmin('org-1', 'member-1');
    orgRepo.setAdmin('org-1', 'other-admin');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(true);
    expect(await orgRepo.isUserAdmin('member-1', 'org-1')).toBe(false);
    expect(orgRepo.removals).toHaveLength(1);
  });

  it('soft-removes target from org boards they belong to, skipping archived boards and other orgs', async () => {
    setupHappyPath();
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));
    boardRepo.addBoard(makeBoard('board-2', 'org-1'));
    boardRepo.addBoard(makeBoard('board-archived', 'org-1', true));
    boardRepo.addBoard(makeBoard('board-other-org', 'org-2'));
    await boardRepo.addUserToBoard('member-1', 'board-1');
    await boardRepo.addUserToBoard('member-1', 'board-archived');
    await boardRepo.addUserToBoard('member-1', 'board-other-org');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(true);
    expect(boardRepo.removals).toEqual([
      {
        userId: 'member-1',
        boardId: 'board-1',
        removedBy: 'superadmin-1',
        removedReason: 'removed_from_organization',
      },
    ]);
  });

  it('deletes membership with audit info (trimmed reason)', async () => {
    setupHappyPath();

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: '  duplicate account  ',
    });

    expect(result.success).toBe(true);
    expect(orgRepo.removals).toEqual([
      {
        organizationId: 'org-1',
        userId: 'member-1',
        removedByUserId: 'superadmin-1',
        reason: 'duplicate account',
      },
    ]);
    expect(await orgRepo.isUserExactMember('member-1', 'org-1')).toBe(false);
  });

  it('notifies the removed member (fire-and-forget)', async () => {
    setupHappyPath();

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(true);

    // Wait for fire-and-forget notification
    await new Promise((r) => setTimeout(r, 10));

    const saved = notifRepo.getSaved();
    expect(saved).not.toBeNull();
    expect(saved!.userId).toBe('member-1');
    expect(saved!.type).toBe('member_removed_from_organization');
    expect(saved!.data).toEqual({
      organizationId: 'org-1',
      organizationName: 'Test Org',
    });
  });

  it('succeeds even when the notification save fails', async () => {
    setupHappyPath();
    notifRepo.failNext = true;

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(true);

    await new Promise((r) => setTimeout(r, 10));

    expect(orgRepo.removals).toHaveLength(1);
  });
});
