/** Verifies Remove Org Member behavior through application ports.
 * Notification doubles return explicit append outcomes, matching the production writer. */
import { success } from '@/domain/shared/Result';
import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import {
  notificationIds,
  notificationClock,
} from '@/application/shared/__tests__/notificationCreation';
import { UserId } from '../../../domain/shared/EntityIds';
import { OrganizationName } from '../../../domain/organization/OrganizationValues';
import { OrganizationId } from '../../../domain/shared/EntityIds';
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

  async save(org: Organization): ReturnType<OrganizationRepository['save']> {
    this.organizations.set(org.id, org);

    return org;
  }
  async findById(id: string): ReturnType<OrganizationRepository['findById']> {
    return this.organizations.get(id) || null;
  }
  async findByName(): ReturnType<OrganizationRepository['findByName']> {
    return null;
  }
  async findByCreatorId(): ReturnType<
    OrganizationRepository['findByCreatorId']
  > {
    return [];
  }
  async findByParentId(): ReturnType<OrganizationRepository['findByParentId']> {
    return [];
  }
  async getAncestorIds(): ReturnType<OrganizationRepository['getAncestorIds']> {
    return OrganizationId.array().parse([]);
  }
  async getDescendantIds(): ReturnType<
    OrganizationRepository['getDescendantIds']
  > {
    return OrganizationId.array().parse([]);
  }
  async getFullTreeOrgIds(): ReturnType<
    OrganizationRepository['getFullTreeOrgIds']
  > {
    return OrganizationId.array().parse([]);
  }
  async isUserMember(): ReturnType<OrganizationRepository['isUserMember']> {
    return false;
  }
  async isUserExactMember(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserExactMember']> {
    const members = this.members.get(organizationId);

    return members ? members.has(userId) : false;
  }
  async isUserAdmin(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserAdmin']> {
    const admins = this.adminRoles.get(organizationId);

    return admins ? admins.has(userId) : false;
  }
  async findMembershipsByUserId(): ReturnType<
    OrganizationRepository['findMembershipsByUserId']
  > {
    return [];
  }
  async findAdminOrganizationsByUserId(): ReturnType<
    OrganizationRepository['findAdminOrganizationsByUserId']
  > {
    return [];
  }
  async findAllWithStats(): ReturnType<
    OrganizationRepository['findAllWithStats']
  > {
    return [];
  }
  async searchOrganizationsWithStats(): ReturnType<
    OrganizationRepository['searchOrganizationsWithStats']
  > {
    return { organizations: [], totalCount: ResultCount.parse(0) };
  }
  async update(
    org: Organization
  ): ReturnType<OrganizationRepository['update']> {
    return org;
  }
  async findAcceptedMemberUserIdsIncludingDescendants(): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    return UserId.array().parse([]);
  }
  async findAcceptedMemberUserIdsForOrgs(): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsForOrgs']
  > {
    return UserId.array().parse([]);
  }
  async removeUserFromOrganization(): ReturnType<
    OrganizationRepository['removeUserFromOrganization']
  > {}
  async removeMemberFromOrganization(
    organizationId: string,
    userId: string,
    removedByUserId: string,
    reason: string
  ): ReturnType<OrganizationRepository['removeMemberFromOrganization']> {
    this.members.get(organizationId)?.delete(userId);
    this.removals.push({ organizationId, userId, removedByUserId, reason });
  }
  async findPendingRequestsByUserId(): ReturnType<
    OrganizationRepository['findPendingRequestsByUserId']
  > {
    return [];
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
  async findAdminUserIds(
    organizationId: string
  ): ReturnType<OrganizationRepository['findAdminUserIds']> {
    const admins = this.adminRoles.get(organizationId);

    return UserId.array().parse(admins ? Array.from(admins) : []);
  }
  async setParentId(): ReturnType<OrganizationRepository['setParentId']> {}
  async addAdmin(
    organizationId: string,
    userId: string
  ): ReturnType<OrganizationRepository['addAdmin']> {
    if (!this.adminRoles.has(organizationId)) {
      this.adminRoles.set(organizationId, new Set());
    }

    this.adminRoles.get(organizationId)!.add(userId);
  }
  async removeAdmin(
    organizationId: string,
    userId: string
  ): ReturnType<OrganizationRepository['removeAdmin']> {
    const admins = this.adminRoles.get(organizationId);

    if (admins && admins.size <= 1) {
      throw new LastAdminError();
    }

    admins?.delete(userId);
  }
  async searchByNameFuzzy(): ReturnType<
    OrganizationRepository['searchByNameFuzzy']
  > {
    return [];
  }
  async getRootAllowMultiTreeMembership(): ReturnType<
    OrganizationRepository['getRootAllowMultiTreeMembership']
  > {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs(): ReturnType<
    OrganizationRepository['findUsersWithMultipleMembershipsInOrgs']
  > {
    return UserId.array().parse([]);
  }
  async setAllowMultiTreeMembership(): ReturnType<
    OrganizationRepository['setAllowMultiTreeMembership']
  > {}

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

  async getAdminUserIds(
    ..._args: Parameters<OrganizationRepository['getAdminUserIds']>
  ): ReturnType<OrganizationRepository['getAdminUserIds']> {
    throw new Error('Unexpected getAdminUserIds in this test');
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

  async save(board: Board): ReturnType<BoardRepository['save']> {
    this.boards.set(board.id, board);

    return board;
  }
  async findById(id: string): ReturnType<BoardRepository['findById']> {
    return this.boards.get(id) || null;
  }
  async findByOrganizationId(
    organizationId: string
  ): ReturnType<BoardRepository['findByOrganizationId']> {
    return Array.from(this.boards.values()).filter(
      (b) => b.organizationId === organizationId
    );
  }
  async findBoardMembers(
    boardId: string
  ): ReturnType<BoardRepository['findBoardMembers']> {
    const members = this.members.get(boardId);

    return members
      ? Array.from(members).map((userId) => ({ userId: UserId.parse(userId) }))
      : [];
  }
  async isUserMember(
    userId: string,
    boardId: string
  ): ReturnType<BoardRepository['isUserMember']> {
    const members = this.members.get(boardId);

    return members ? members.has(userId) : false;
  }
  async addUserToBoard(
    userId: string,
    boardId: string
  ): ReturnType<BoardRepository['addUserToBoard']> {
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
  ): ReturnType<BoardRepository['removeUserFromBoard']> {
    this.members.get(boardId)?.delete(userId);
    this.removals.push({ userId, boardId, removedBy, removedReason });
  }
  async update(board: Board): ReturnType<BoardRepository['update']> {
    this.boards.set(board.id, board);

    return board;
  }
  async findActiveBoardsByUserId(): ReturnType<
    BoardRepository['findActiveBoardsByUserId']
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

  async findById(id: string): ReturnType<UserRepository['findById']> {
    return this.users.get(id) || null;
  }
  async findByIds(): ReturnType<UserRepository['findByIds']> {
    return [];
  }
  async findByPhoneNumber(): ReturnType<UserRepository['findByPhoneNumber']> {
    return null;
  }
  async save(user: User): ReturnType<UserRepository['save']> {
    return user;
  }
  async exists(): ReturnType<UserRepository['exists']> {
    return false;
  }
  async searchUsers(): ReturnType<UserRepository['searchUsers']> {
    return [];
  }
  async searchUserByPhone(): ReturnType<UserRepository['searchUserByPhone']> {
    return null;
  }
  async isSuperAdmin(
    userId: string
  ): ReturnType<UserRepository['isSuperAdmin']> {
    return this.superAdmins.has(userId);
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

  // Test helper
  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }

  async findByEmail(
    ..._args: Parameters<UserRepository['findByEmail']>
  ): ReturnType<UserRepository['findByEmail']> {
    throw new Error('Unexpected findByEmail in this test');
  }
}

class MockNotificationRepository implements NotificationRepository {
  private saved: Notification | null = null;
  public failNext = false;

  async save(
    notification: Notification
  ): ReturnType<NotificationRepository['save']> {
    if (this.failNext) {
      throw new Error('save failed');
    }

    this.saved = notification;

    return success(notification);
  }
  async saveBatch(): ReturnType<NotificationRepository['saveBatch']> {
    return success(undefined);
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
      ids: notificationIds,
      clock: notificationClock,
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
