import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetUserPendingInvitesUseCase } from '../GetUserPendingInvitesUseCase';
import { InvitationRepository } from '../../../domain/invitation/InvitationRepository';
import { Invitation } from '../../../domain/invitation/Invitation';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Organization } from '../../../domain/organization/Organization';
import { Board } from '../../../domain/board/Board';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';

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
  async findPendingByInviteeId(inviteeId: string): Promise<Invitation[]> {
    return this.invitations.filter(
      (inv) => inv.inviteeId === inviteeId && inv.isPending()
    );
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
    this.invitations.push(invitation);
  }
}

class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();

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
  async isUserAdmin(): Promise<boolean> {
    return false;
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
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
  async findByIds(ids: string[]): Promise<User[]> {
    return ids
      .map((id) => this.users.get(id))
      .filter((u): u is User => u !== undefined);
  }
  async findByPhoneNumber(): Promise<User | null> {
    return null;
  }
  async findByNickname(): Promise<User | null> {
    return null;
  }
  async isNicknameAvailable(): Promise<boolean> {
    return true;
  }
  async save(user: User): Promise<User> {
    return user;
  }
  async confirmUser(): Promise<void> {}
  async updatePrivacySettings(): Promise<void> {}
  async exists(): Promise<boolean> {
    return false;
  }
  async searchUsers(): Promise<User[]> {
    return [];
  }
  async searchUserByPhone(): Promise<User | null> {
    return null;
  }
  async isSuperAdmin(): Promise<boolean> {
    return false;
  }
  async isUserBlocked(): Promise<boolean> {
    return false;
  }
  async blockUser(): Promise<void> {}
  async unblockUser(): Promise<void> {}
  async getBlockStatus(): Promise<null> {
    return null;
  }
  async getBlockedUserIds(): Promise<string[]> {
    return [];
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
  }
}

function makeOrg(id: string, name: string): Organization {
  return Organization.reconstitute({
    id,
    name,
    description: 'Test',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: false,
  });
}

function makeBoard(id: string, orgId: string, name: string): Board {
  const result = Board.create(name, orgId);

  if (!result.success) {
    throw new Error('Failed to create board');
  }

  const board = result.value;
  (board as any).props.id = id;

  return board;
}

function makeUser(
  id: string,
  firstName: string,
  lastName: string,
  middleName?: string
): User {
  const user = User.create({
    firstName,
    lastName,
    middleName,
    phoneNumber: PhoneNumber.create(`+1234567${id.replace(/\D/g, '0')}`),
    password: 'password123',
  });
  (user as any).props.id = id;

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

describe('GetUserPendingInvitesUseCase', () => {
  let useCase: GetUserPendingInvitesUseCase;
  let invitationRepo: MockInvitationRepository;
  let orgRepo: MockOrganizationRepository;
  let boardRepo: MockBoardRepository;
  let userRepo: MockUserRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    invitationRepo = new MockInvitationRepository();
    orgRepo = new MockOrganizationRepository();
    boardRepo = new MockBoardRepository();
    userRepo = new MockUserRepository();

    useCase = new GetUserPendingInvitesUseCase({
      invitationRepository: invitationRepo,
      organizationRepository: orgRepo,
      boardRepository: boardRepo,
      userRepository: userRepo,
    });
  });

  it('should return empty array when no pending invites', async () => {
    const result = await useCase.execute({ actorUserId: 'user-2' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual([]);
    }
  });

  it('should return enriched details for pending invites', async () => {
    const inviter = makeUser('user-1', 'Ivan', 'Petrov', 'Sergeevich');
    userRepo.addUser(inviter);

    const org = makeOrg('org-1', 'Test Organization');
    orgRepo.addOrganization(org);

    const inv = makePendingInvitation('inv-1', {
      organizationId: 'org-1',
      inviterId: 'user-1',
      inviteeId: 'user-2',
      type: 'admin_invite',
    });
    invitationRepo.addInvitation(inv);

    const result = await useCase.execute({ actorUserId: 'user-2' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toHaveLength(1);
      const detail = result.value[0];
      expect(detail.id).toBe('inv-1');
      expect(detail.type).toBe('admin_invite');
      expect(detail.status).toBe('pending');
      expect(detail.organizationName).toBe('Test Organization');
      expect(detail.organizationId).toBe('org-1');
      expect(detail.boardName).toBeNull();
      expect(detail.boardId).toBeNull();
      expect(detail.inviterName).toBe('Petrov Ivan Sergeevich');
      expect(detail.inviteeId).toBe('user-2');
    }
  });

  it('should handle board invites (includes board name)', async () => {
    const inviter = makeUser('user-1', 'Anna', 'Sidorova');
    userRepo.addUser(inviter);

    const org = makeOrg('org-1', 'My Org');
    orgRepo.addOrganization(org);

    const board = makeBoard('board-1', 'org-1', 'Finance Board');
    boardRepo.addBoard(board);

    const inv = makePendingInvitation('inv-1', {
      organizationId: 'org-1',
      boardId: 'board-1',
      inviterId: 'user-1',
      inviteeId: 'user-2',
      type: 'board_member_invite',
    });
    invitationRepo.addInvitation(inv);

    const result = await useCase.execute({ actorUserId: 'user-2' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toHaveLength(1);
      const detail = result.value[0];
      expect(detail.type).toBe('board_member_invite');
      expect(detail.organizationName).toBe('My Org');
      expect(detail.boardName).toBe('Finance Board');
      expect(detail.boardId).toBe('board-1');
      expect(detail.inviterName).toBe('Sidorova Anna');
    }
  });

  it('should batch-resolve names for multiple invites', async () => {
    // Same inviter for two invites — should only be looked up once
    const inviter = makeUser('user-1', 'Ivan', 'Petrov');
    userRepo.addUser(inviter);

    const org1 = makeOrg('org-1', 'Org One');
    const org2 = makeOrg('org-2', 'Org Two');
    orgRepo.addOrganization(org1);
    orgRepo.addOrganization(org2);

    invitationRepo.addInvitation(
      makePendingInvitation('inv-1', {
        organizationId: 'org-1',
        inviterId: 'user-1',
        inviteeId: 'user-2',
        type: 'admin_invite',
      })
    );
    invitationRepo.addInvitation(
      makePendingInvitation('inv-2', {
        organizationId: 'org-2',
        inviterId: 'user-1',
        inviteeId: 'user-2',
        type: 'member_invite',
      })
    );

    const findByIdsSpy = vi.spyOn(userRepo, 'findByIds');

    const result = await useCase.execute({ actorUserId: 'user-2' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0].organizationName).toBe('Org One');
      expect(result.value[1].organizationName).toBe('Org Two');
    }

    // findByIds called once with deduplicated inviter IDs
    expect(findByIdsSpy).toHaveBeenCalledTimes(1);
    expect(findByIdsSpy).toHaveBeenCalledWith(['user-1']);
  });
});
