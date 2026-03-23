import { describe, it, expect, beforeEach } from 'vitest';
import { GetPendingAdminInvitesUseCase } from '../GetPendingAdminInvitesUseCase';
import { InvitationRepository } from '../../../domain/invitation/InvitationRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Invitation } from '../../../domain/invitation/Invitation';
import { Organization } from '../../../domain/organization/Organization';
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
  async findPendingByOrganizationId(
    organizationId: string,
    type: string
  ): Promise<Invitation[]> {
    return this.invitations.filter(
      (inv) =>
        inv.organizationId === organizationId &&
        inv.type === type &&
        inv.isPending()
    );
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
  async getBlockedUserIds(): Promise<string[]> {
    return [];
  }

  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
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

function makePendingInvitation(id: string, orgId: string): Invitation {
  return Invitation.reconstitute({
    id,
    organizationId: orgId,
    boardId: null,
    inviterId: 'user-1',
    inviteeId: 'user-2',
    type: 'admin_invite',
    status: 'pending',
    createdAt: new Date(),
    handledAt: null,
  });
}

describe('GetPendingAdminInvitesUseCase', () => {
  let useCase: GetPendingAdminInvitesUseCase;
  let invitationRepo: MockInvitationRepository;
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;

  beforeEach(() => {
    invitationRepo = new MockInvitationRepository();
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();

    useCase = new GetPendingAdminInvitesUseCase({
      invitationRepository: invitationRepo,
      organizationRepository: orgRepo,
      userRepository: userRepo,
    });
  });

  it('should fail when user is not an admin of the organization', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));

    const result = await useCase.execute({
      organizationId: 'org-1',
      actorUserId: 'non-admin-user',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.NOT_ADMIN);
    }
  });

  it('should succeed when user is an admin', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-user');

    const inv = makePendingInvitation('inv-1', 'org-1');
    invitationRepo.addInvitation(inv);

    const result = await useCase.execute({
      organizationId: 'org-1',
      actorUserId: 'admin-user',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toHaveLength(1);
    }
  });

  it('should succeed when user is a superadmin', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    userRepo.addSuperAdmin('super-user');

    const inv = makePendingInvitation('inv-1', 'org-1');
    invitationRepo.addInvitation(inv);

    const result = await useCase.execute({
      organizationId: 'org-1',
      actorUserId: 'super-user',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toHaveLength(1);
    }
  });
});
