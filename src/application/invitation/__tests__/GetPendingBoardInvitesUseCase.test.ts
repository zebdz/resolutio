import { describe, it, expect, beforeEach } from 'vitest';
import { GetPendingBoardInvitesUseCase } from '../GetPendingBoardInvitesUseCase';
import { InvitationRepository } from '../../../domain/invitation/InvitationRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { Invitation } from '../../../domain/invitation/Invitation';
import { Organization } from '../../../domain/organization/Organization';
import { Board } from '../../../domain/board/Board';
import { InvitationErrors } from '../InvitationErrors';

class MockInvitationRepository implements InvitationRepository {
  private invitations: Invitation[] = [];

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
  async findPendingByBoardId(boardId: string): Promise<Invitation[]> {
    return this.invitations.filter(
      (inv) => inv.boardId === boardId && inv.isPending()
    );
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
    this.invitations.push(invitation);
  }
}

class MockOrganizationRepository implements OrganizationRepository {
  private adminRoles: Map<string, Set<string>> = new Map();

  async save(org: Organization): Promise<Organization> {
    return org;
  }
  async findById(): Promise<Organization | null> {
    return null;
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

  setAdmin(orgId: string, userId: string): void {
    if (!this.adminRoles.has(orgId)) {
      this.adminRoles.set(orgId, new Set());
    }

    this.adminRoles.get(orgId)!.add(userId);
  }
}

class MockBoardRepository implements BoardRepository {
  private boards: Map<string, Board> = new Map();

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
  async isUserMember(): Promise<boolean> {
    return false;
  }
  async addUserToBoard(): Promise<void> {}
  async removeUserFromBoard(): Promise<void> {}
  async update(board: Board): Promise<Board> {
    return board;
  }

  addBoard(board: Board): void {
    this.boards.set(board.id, board);
  }
}

class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();

  async findById(): Promise<any> {
    return null;
  }
  async findByIds(): Promise<any[]> {
    return [];
  }
  async findByPhoneNumber(): Promise<any> {
    return null;
  }
  async findByNickname(): Promise<any> {
    return null;
  }
  async isNicknameAvailable(): Promise<boolean> {
    return true;
  }
  async save(user: any): Promise<any> {
    return user;
  }
  async confirmUser(): Promise<void> {}
  async updatePrivacySettings(): Promise<void> {}
  async exists(): Promise<boolean> {
    return false;
  }
  async searchUsers(): Promise<any[]> {
    return [];
  }
  async searchUserByPhone(): Promise<any> {
    return null;
  }
  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }
  async isUserBlocked(): Promise<boolean> {
    return false;
  }
  async blockUser(): Promise<void> {}
  async unblockUser(): Promise<void> {}
  async getBlockStatus(): Promise<null> {
    return null;
  }

  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }
}

function makeBoard(id: string, orgId: string): Board {
  const result = Board.create('Test Board', orgId);

  if (!result.success) {
    throw new Error('Failed to create board');
  }

  const board = result.value;
  (board as any).props.id = id;

  return board;
}

function makePendingInvitation(
  id: string,
  orgId: string,
  boardId: string
): Invitation {
  return Invitation.reconstitute({
    id,
    organizationId: orgId,
    boardId,
    inviterId: 'user-1',
    inviteeId: 'user-2',
    type: 'board_member_invite',
    status: 'pending',
    createdAt: new Date(),
    handledAt: null,
  });
}

describe('GetPendingBoardInvitesUseCase', () => {
  let useCase: GetPendingBoardInvitesUseCase;
  let invitationRepo: MockInvitationRepository;
  let orgRepo: MockOrganizationRepository;
  let boardRepo: MockBoardRepository;
  let userRepo: MockUserRepository;

  beforeEach(() => {
    invitationRepo = new MockInvitationRepository();
    orgRepo = new MockOrganizationRepository();
    boardRepo = new MockBoardRepository();
    userRepo = new MockUserRepository();

    useCase = new GetPendingBoardInvitesUseCase({
      invitationRepository: invitationRepo,
      organizationRepository: orgRepo,
      boardRepository: boardRepo,
      userRepository: userRepo,
    });
  });

  it('should fail when board not found', async () => {
    const result = await useCase.execute({
      boardId: 'nonexistent',
      actorUserId: 'user-1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.BOARD_NOT_FOUND);
    }
  });

  it('should fail when user is not an admin of the board org', async () => {
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));

    const result = await useCase.execute({
      boardId: 'board-1',
      actorUserId: 'non-admin-user',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.NOT_ADMIN);
    }
  });

  it('should succeed when user is an admin of the board org', async () => {
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));
    orgRepo.setAdmin('org-1', 'admin-user');

    const inv = makePendingInvitation('inv-1', 'org-1', 'board-1');
    invitationRepo.addInvitation(inv);

    const result = await useCase.execute({
      boardId: 'board-1',
      actorUserId: 'admin-user',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toHaveLength(1);
    }
  });

  it('should succeed when user is a superadmin', async () => {
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));
    userRepo.addSuperAdmin('super-user');

    const inv = makePendingInvitation('inv-1', 'org-1', 'board-1');
    invitationRepo.addInvitation(inv);

    const result = await useCase.execute({
      boardId: 'board-1',
      actorUserId: 'super-user',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toHaveLength(1);
    }
  });
});
