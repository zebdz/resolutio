import { describe, it, expect, beforeEach } from 'vitest';
import { CancelJoinParentRequestUseCase } from '../CancelJoinParentRequestUseCase';
import { OrganizationErrors } from '../OrganizationErrors';
import { JoinParentRequest } from '../../../domain/organization/JoinParentRequest';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { JoinParentRequestRepository } from '../../../domain/organization/JoinParentRequestRepository';
import { UserRepository } from '../../../domain/user/UserRepository';

// Mock JoinParentRequestRepository
class MockJoinParentRequestRepository implements JoinParentRequestRepository {
  private requests: Map<string, JoinParentRequest> = new Map();
  private deletedIds: string[] = [];

  async save(request: JoinParentRequest): Promise<JoinParentRequest> {
    return request;
  }
  async findById(id: string): Promise<JoinParentRequest | null> {
    return this.requests.get(id) || null;
  }
  async findPendingByChildOrgId(): Promise<JoinParentRequest | null> {
    return null;
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
  async delete(id: string): Promise<void> {
    this.deletedIds.push(id);
    this.requests.delete(id);
  }

  addRequest(request: JoinParentRequest) {
    this.requests.set(request.id, request);
  }
  getDeletedIds() {
    return this.deletedIds;
  }
}

// Mock OrganizationRepository (minimal for admin check)
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

  // Stubs for interface
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
}

// Mock UserRepository
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
  childOrgId: string
): JoinParentRequest {
  return JoinParentRequest.reconstitute({
    id,
    childOrgId,
    parentOrgId: 'parent-1',
    requestingAdminId: 'admin-1',
    handlingAdminId: null,
    message: 'Request message',
    status: 'pending',
    rejectionReason: null,
    createdAt: new Date(),
    handledAt: null,
  });
}

describe('CancelJoinParentRequestUseCase', () => {
  let useCase: CancelJoinParentRequestUseCase;
  let joinParentRepo: MockJoinParentRequestRepository;
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;

  beforeEach(() => {
    joinParentRepo = new MockJoinParentRequestRepository();
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();

    useCase = new CancelJoinParentRequestUseCase({
      joinParentRequestRepository: joinParentRepo,
      organizationRepository: orgRepo as unknown as OrganizationRepository,
      userRepository: userRepo as unknown as UserRepository,
    });
  });

  it('should successfully cancel a pending request', async () => {
    const request = createPendingRequest('req-1', 'child-1');
    joinParentRepo.addRequest(request);
    orgRepo.addAdmin('child-1', 'admin-1');

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'admin-1',
    });

    expect(result.success).toBe(true);
    expect(joinParentRepo.getDeletedIds()).toContain('req-1');
  });

  it('should fail if request not found', async () => {
    const result = await useCase.execute({
      requestId: 'nonexistent',
      adminUserId: 'admin-1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.PARENT_REQUEST_NOT_FOUND);
    }
  });

  it('should fail if request is not pending', async () => {
    const request = JoinParentRequest.reconstitute({
      id: 'req-1',
      childOrgId: 'child-1',
      parentOrgId: 'parent-1',
      requestingAdminId: 'admin-1',
      handlingAdminId: 'other-admin',
      message: 'Request message',
      status: 'accepted',
      rejectionReason: null,
      createdAt: new Date(),
      handledAt: new Date(),
    });
    joinParentRepo.addRequest(request);
    orgRepo.addAdmin('child-1', 'admin-1');

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'admin-1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.PARENT_REQUEST_NOT_PENDING);
    }
  });

  it('should fail if user is not admin of child org', async () => {
    const request = createPendingRequest('req-1', 'child-1');
    joinParentRepo.addRequest(request);

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'not-admin',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  it('should allow superadmin to cancel', async () => {
    const request = createPendingRequest('req-1', 'child-1');
    joinParentRepo.addRequest(request);
    userRepo.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      requestId: 'req-1',
      adminUserId: 'superadmin-1',
    });

    expect(result.success).toBe(true);
    expect(joinParentRepo.getDeletedIds()).toContain('req-1');
  });
});
