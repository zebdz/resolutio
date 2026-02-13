import { describe, it, expect, beforeEach } from 'vitest';
import { GetAllJoinParentRequestsUseCase } from '../GetAllJoinParentRequestsUseCase';
import { OrganizationErrors } from '../OrganizationErrors';
import { JoinParentRequest } from '../../../domain/organization/JoinParentRequest';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { JoinParentRequestRepository } from '../../../domain/organization/JoinParentRequestRepository';
import { UserRepository } from '../../../domain/user/UserRepository';

class MockJoinParentRequestRepository implements JoinParentRequestRepository {
  private allByChild: Map<string, JoinParentRequest[]> = new Map();
  private allByParent: Map<string, JoinParentRequest[]> = new Map();

  async save(request: JoinParentRequest): Promise<JoinParentRequest> {
    return request;
  }
  async findById(): Promise<JoinParentRequest | null> {
    return null;
  }
  async findPendingByChildOrgId(): Promise<JoinParentRequest | null> {
    return null;
  }
  async findPendingByParentOrgId(): Promise<JoinParentRequest[]> {
    return [];
  }
  async findAllByChildOrgId(childOrgId: string): Promise<JoinParentRequest[]> {
    return this.allByChild.get(childOrgId) || [];
  }
  async findAllByParentOrgId(
    parentOrgId: string
  ): Promise<JoinParentRequest[]> {
    return this.allByParent.get(parentOrgId) || [];
  }
  async update(request: JoinParentRequest): Promise<JoinParentRequest> {
    return request;
  }
  async delete(): Promise<void> {}

  setAllForChildOrg(childOrgId: string, requests: JoinParentRequest[]) {
    this.allByChild.set(childOrgId, requests);
  }
  setAllForParentOrg(parentOrgId: string, requests: JoinParentRequest[]) {
    this.allByParent.set(parentOrgId, requests);
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

function createRequest(
  id: string,
  childOrgId: string,
  parentOrgId: string,
  status: 'pending' | 'accepted' | 'rejected' = 'pending'
): JoinParentRequest {
  return JoinParentRequest.reconstitute({
    id,
    childOrgId,
    parentOrgId,
    requestingAdminId: 'some-admin',
    handlingAdminId: status !== 'pending' ? 'handler' : null,
    message: 'Request message',
    status,
    rejectionReason: status === 'rejected' ? 'Some reason' : null,
    createdAt: new Date(),
    handledAt: status !== 'pending' ? new Date() : null,
  });
}

describe('GetAllJoinParentRequestsUseCase', () => {
  let useCase: GetAllJoinParentRequestsUseCase;
  let joinParentRepo: MockJoinParentRequestRepository;
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;

  beforeEach(() => {
    joinParentRepo = new MockJoinParentRequestRepository();
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();

    useCase = new GetAllJoinParentRequestsUseCase({
      joinParentRequestRepository: joinParentRepo,
      organizationRepository: orgRepo as unknown as OrganizationRepository,
      userRepository: userRepo as unknown as UserRepository,
    });
  });

  it('should return incoming and outgoing requests for org', async () => {
    orgRepo.addAdmin('org-1', 'admin-1');

    const incoming1 = createRequest('r1', 'child-a', 'org-1', 'pending');
    const incoming2 = createRequest('r2', 'child-b', 'org-1', 'accepted');
    joinParentRepo.setAllForParentOrg('org-1', [incoming1, incoming2]);

    const outgoing1 = createRequest('r3', 'org-1', 'parent-x', 'rejected');
    joinParentRepo.setAllForChildOrg('org-1', [outgoing1]);

    const result = await useCase.execute({
      organizationId: 'org-1',
      adminUserId: 'admin-1',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.incoming).toHaveLength(2);
      expect(result.value.outgoing).toHaveLength(1);
      expect(result.value.incoming[0].id).toBe('r1');
      expect(result.value.outgoing[0].id).toBe('r3');
    }
  });

  it('should fail if not admin of org', async () => {
    const result = await useCase.execute({
      organizationId: 'org-1',
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
      organizationId: 'org-1',
      adminUserId: 'superadmin-1',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.incoming).toHaveLength(0);
      expect(result.value.outgoing).toHaveLength(0);
    }
  });

  it('should return empty arrays when no requests', async () => {
    orgRepo.addAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      adminUserId: 'admin-1',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.incoming).toHaveLength(0);
      expect(result.value.outgoing).toHaveLength(0);
    }
  });
});
