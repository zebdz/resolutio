import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RevokeInviteUseCase } from '../RevokeInviteUseCase';
import { InvitationRepository } from '../../../domain/invitation/InvitationRepository';
import { Invitation } from '../../../domain/invitation/Invitation';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Organization } from '../../../domain/organization/Organization';
import { InvitationErrors } from '../InvitationErrors';

function makeInvitation(
  overrides?: Partial<Parameters<typeof Invitation.reconstitute>[0]>
) {
  return Invitation.reconstitute({
    id: 'inv-1',
    organizationId: 'org-1',
    boardId: null,
    inviterId: 'admin-1',
    inviteeId: 'user-1',
    type: 'admin_invite',
    status: 'pending',
    createdAt: new Date(),
    handledAt: null,
    ...overrides,
  });
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

class MockInvitationRepository implements InvitationRepository {
  private invitations: Map<string, Invitation> = new Map();
  update = vi.fn(async (invitation: Invitation): Promise<Invitation> => {
    this.invitations.set(invitation.id, invitation);

    return invitation;
  });

  async save(invitation: Invitation): Promise<Invitation> {
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
  async save(user: any): Promise<any> {
    return user;
  }
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
  async findByNickname(): Promise<any> {
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

describe('RevokeInviteUseCase', () => {
  let useCase: RevokeInviteUseCase;
  let invitationRepo: MockInvitationRepository;
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    invitationRepo = new MockInvitationRepository();
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();
    notifRepo = new MockNotificationRepository();
    useCase = new RevokeInviteUseCase({
      invitationRepository: invitationRepo,
      organizationRepository: orgRepo,
      userRepository: userRepo,
      notificationRepository: notifRepo,
    });
  });

  it('should fail when invitation not found', async () => {
    const result = await useCase.execute({
      invitationId: 'nonexistent',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.NOT_FOUND);
    }
  });

  it('should fail when invitation not pending', async () => {
    invitationRepo.addInvitation(
      makeInvitation({ status: 'declined', handledAt: new Date() })
    );
    const result = await useCase.execute({
      invitationId: 'inv-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.NOT_PENDING);
    }
  });

  it('should fail when actor is not admin or superadmin', async () => {
    invitationRepo.addInvitation(makeInvitation());
    orgRepo.addOrganization(makeOrg('org-1'));
    const result = await useCase.execute({
      invitationId: 'inv-1',
      actorUserId: 'random-user',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(InvitationErrors.NOT_ADMIN);
    }
  });

  it('should succeed when org admin revokes', async () => {
    invitationRepo.addInvitation(makeInvitation());
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    const result = await useCase.execute({
      invitationId: 'inv-1',
      actorUserId: 'admin-1',
    });
    expect(result.success).toBe(true);
    const updated = await invitationRepo.findById('inv-1');
    expect(updated!.status).toBe('revoked');
  });

  it('should succeed when superadmin revokes', async () => {
    invitationRepo.addInvitation(makeInvitation());
    orgRepo.addOrganization(makeOrg('org-1'));
    userRepo.addSuperAdmin('superadmin-1');
    const result = await useCase.execute({
      invitationId: 'inv-1',
      actorUserId: 'superadmin-1',
    });
    expect(result.success).toBe(true);
    const updated = await invitationRepo.findById('inv-1');
    expect(updated!.status).toBe('revoked');
  });

  it('should call update on repository after revoking', async () => {
    invitationRepo.addInvitation(makeInvitation());
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    await useCase.execute({
      invitationId: 'inv-1',
      actorUserId: 'admin-1',
    });
    expect(invitationRepo.update).toHaveBeenCalledOnce();
    const updatedInvitation = invitationRepo.update.mock.calls[0][0];
    expect(updatedInvitation.status).toBe('revoked');
  });
});
