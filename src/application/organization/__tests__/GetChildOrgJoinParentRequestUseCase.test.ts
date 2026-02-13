import { describe, it, expect, beforeEach } from 'vitest';
import { GetChildOrgJoinParentRequestUseCase } from '../GetChildOrgJoinParentRequestUseCase';
import { OrganizationErrors } from '../OrganizationErrors';
import { JoinParentRequest } from '../../../domain/organization/JoinParentRequest';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { JoinParentRequestRepository } from '../../../domain/organization/JoinParentRequestRepository';
import { UserRepository } from '../../../domain/user/UserRepository';

// Mock JoinParentRequestRepository
class MockJoinParentRequestRepository implements JoinParentRequestRepository {
  private pendingByChildOrg: Map<string, JoinParentRequest> = new Map();

  async save(request: JoinParentRequest): Promise<JoinParentRequest> {
    return request;
  }
  async findById(): Promise<JoinParentRequest | null> {
    return null;
  }
  async findPendingByChildOrgId(
    childOrgId: string
  ): Promise<JoinParentRequest | null> {
    return this.pendingByChildOrg.get(childOrgId) || null;
  }
  async findPendingByParentOrgId(): Promise<JoinParentRequest[]> {
    return [];
  }
  async findAllByChildOrgId(): Promise<JoinParentRequest[]> {
    return [];
  }
  async findAllByParentOrgId(): Promise<JoinParentRequest[]> {
    return [];
  }
  async update(request: JoinParentRequest): Promise<JoinParentRequest> {
    return request;
  }
  async delete(): Promise<void> {}

  setPendingForChildOrg(childOrgId: string, request: JoinParentRequest) {
    this.pendingByChildOrg.set(childOrgId, request);
  }
}

// Minimal mock OrganizationRepository
class MockOrganizationRepository {
  private adminRoles: Map<string, Set<string>> = new Map();

  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    const admins = this.adminRoles.get(organizationId);

    return admins ? admins.has(userId) : false;
  }
  addAdmin(orgId: string, userId: string) {
    if (!this.adminRoles.has(orgId)) {
      this.adminRoles.set(orgId, new Set());
    }

    this.adminRoles.get(orgId)!.add(userId);
  }

  async save() {
    return null as any;
  }
  async findById() {
    return null;
  }
  async findByName() {
    return null;
  }
  async findByCreatorId() {
    return [];
  }
  async findByParentId() {
    return [];
  }
  async getAncestorIds() {
    return [];
  }
  async getDescendantIds() {
    return [];
  }
  async isUserMember() {
    return false;
  }
  async findMembershipsByUserId() {
    return [];
  }
  async findAdminOrganizationsByUserId() {
    return [];
  }
  async findAllWithStats() {
    return [];
  }
  async update() {
    return null as any;
  }
  async findAcceptedMemberUserIdsIncludingDescendants() {
    return [];
  }
  async removeUserFromOrganization() {}
  async findPendingRequestsByUserId() {
    return [];
  }
  async getAncestors() {
    return [];
  }
  async getChildrenWithStats() {
    return [];
  }
  async getHierarchyTree() {
    return {
      ancestors: [],
      tree: { id: '', name: '', memberCount: 0, children: [] },
    };
  }
  async setParentId() {}
  async findAdminUserIds(): Promise<string[]> {
    return [];
  }
}

class MockUserRepository {
  private superAdmins: Set<string> = new Set();
  async findById() {
    return null;
  }
  async findByIds() {
    return [];
  }
  async findByPhoneNumber() {
    return null;
  }
  async save(user: any) {
    return user;
  }
  async exists() {
    return false;
  }
  async searchUsers() {
    return [];
  }
  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }
  addSuperAdmin(userId: string) {
    this.superAdmins.add(userId);
  }
}

describe('GetChildOrgJoinParentRequestUseCase', () => {
  let useCase: GetChildOrgJoinParentRequestUseCase;
  let joinParentRepo: MockJoinParentRequestRepository;
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;

  beforeEach(() => {
    joinParentRepo = new MockJoinParentRequestRepository();
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();

    useCase = new GetChildOrgJoinParentRequestUseCase({
      joinParentRequestRepository: joinParentRepo,
      organizationRepository: orgRepo as unknown as OrganizationRepository,
      userRepository: userRepo as unknown as UserRepository,
    });
  });

  it('should return pending request for child org', async () => {
    orgRepo.addAdmin('child-1', 'admin-1');

    const request = JoinParentRequest.reconstitute({
      id: 'req-1',
      childOrgId: 'child-1',
      parentOrgId: 'parent-1',
      requestingAdminId: 'admin-1',
      handlingAdminId: null,
      message: 'Want to join',
      status: 'pending',
      rejectionReason: null,
      createdAt: new Date(),
      handledAt: null,
    });
    joinParentRepo.setPendingForChildOrg('child-1', request);

    const result = await useCase.execute({
      childOrgId: 'child-1',
      adminUserId: 'admin-1',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).not.toBeNull();
      expect(result.value!.id).toBe('req-1');
    }
  });

  it('should return null when no pending request', async () => {
    orgRepo.addAdmin('child-1', 'admin-1');

    const result = await useCase.execute({
      childOrgId: 'child-1',
      adminUserId: 'admin-1',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toBeNull();
    }
  });

  it('should fail if not admin of child org', async () => {
    const result = await useCase.execute({
      childOrgId: 'child-1',
      adminUserId: 'not-admin',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  it('should allow superadmin', async () => {
    userRepo.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      childOrgId: 'child-1',
      adminUserId: 'superadmin-1',
    });

    expect(result.success).toBe(true);
  });
});
