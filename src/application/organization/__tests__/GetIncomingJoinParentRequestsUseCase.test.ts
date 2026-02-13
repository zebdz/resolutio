import { describe, it, expect, beforeEach } from 'vitest';
import { GetIncomingJoinParentRequestsUseCase } from '../GetIncomingJoinParentRequestsUseCase';
import { OrganizationErrors } from '../OrganizationErrors';
import { JoinParentRequest } from '../../../domain/organization/JoinParentRequest';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { JoinParentRequestRepository } from '../../../domain/organization/JoinParentRequestRepository';
import { UserRepository } from '../../../domain/user/UserRepository';

class MockJoinParentRequestRepository implements JoinParentRequestRepository {
  private pendingByParentOrg: Map<string, JoinParentRequest[]> = new Map();

  async save(request: JoinParentRequest): Promise<JoinParentRequest> {
    return request;
  }
  async findById(): Promise<JoinParentRequest | null> {
    return null;
  }
  async findPendingByChildOrgId(): Promise<JoinParentRequest | null> {
    return null;
  }
  async findPendingByParentOrgId(
    parentOrgId: string
  ): Promise<JoinParentRequest[]> {
    return this.pendingByParentOrg.get(parentOrgId) || [];
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

  setPendingForParentOrg(parentOrgId: string, requests: JoinParentRequest[]) {
    this.pendingByParentOrg.set(parentOrgId, requests);
  }
}

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

function createPendingRequest(
  id: string,
  childOrgId: string,
  parentOrgId: string
): JoinParentRequest {
  return JoinParentRequest.reconstitute({
    id,
    childOrgId,
    parentOrgId,
    requestingAdminId: 'child-admin',
    handlingAdminId: null,
    message: 'Request message',
    status: 'pending',
    rejectionReason: null,
    createdAt: new Date(),
    handledAt: null,
  });
}

describe('GetIncomingJoinParentRequestsUseCase', () => {
  let useCase: GetIncomingJoinParentRequestsUseCase;
  let joinParentRepo: MockJoinParentRequestRepository;
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;

  beforeEach(() => {
    joinParentRepo = new MockJoinParentRequestRepository();
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();

    useCase = new GetIncomingJoinParentRequestsUseCase({
      joinParentRequestRepository: joinParentRepo,
      organizationRepository: orgRepo as unknown as OrganizationRepository,
      userRepository: userRepo as unknown as UserRepository,
    });
  });

  it('should return pending requests for parent org', async () => {
    orgRepo.addAdmin('parent-1', 'admin-1');

    const req1 = createPendingRequest('req-1', 'child-1', 'parent-1');
    const req2 = createPendingRequest('req-2', 'child-2', 'parent-1');
    joinParentRepo.setPendingForParentOrg('parent-1', [req1, req2]);

    const result = await useCase.execute({
      parentOrgId: 'parent-1',
      adminUserId: 'admin-1',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toHaveLength(2);
    }
  });

  it('should return empty array when no pending requests', async () => {
    orgRepo.addAdmin('parent-1', 'admin-1');

    const result = await useCase.execute({
      parentOrgId: 'parent-1',
      adminUserId: 'admin-1',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toHaveLength(0);
    }
  });

  it('should fail if not admin of parent org', async () => {
    const result = await useCase.execute({
      parentOrgId: 'parent-1',
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
      parentOrgId: 'parent-1',
      adminUserId: 'superadmin-1',
    });

    expect(result.success).toBe(true);
  });
});
