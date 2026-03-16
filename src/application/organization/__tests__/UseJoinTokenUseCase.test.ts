import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UseJoinTokenUseCase } from '../UseJoinTokenUseCase';
import { JoinToken } from '../../../domain/organization/JoinToken';
import { JoinTokenRepository } from '../../../domain/organization/JoinTokenRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { JoinOrganizationUseCase } from '../JoinOrganizationUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { JoinTokenErrors } from '../JoinTokenErrors';
import { OrganizationErrors } from '../OrganizationErrors';
import { success, failure } from '../../../domain/shared/Result';

function createMockJoinToken(
  overrides: Partial<{
    id: string;
    organizationId: string;
    token: string;
    description: string;
    maxUses: number | null;
    useCount: number;
    createdById: string;
    createdAt: Date;
    expiredAt: Date | null;
  }> = {}
): JoinToken {
  return JoinToken.reconstitute({
    id: overrides.id ?? 'token-id-1',
    organizationId: overrides.organizationId ?? 'org-123',
    token: overrides.token ?? 'abc123defg',
    description: overrides.description ?? 'Test token',
    maxUses: overrides.maxUses ?? null,
    useCount: overrides.useCount ?? 0,
    createdById: overrides.createdById ?? 'admin-1',
    createdAt: overrides.createdAt ?? new Date(),
    expiredAt: overrides.expiredAt ?? null,
  });
}

function createMockOrg(id: string, archived = false): Organization {
  const result = Organization.create('Test Org', 'desc', 'creator-1');

  if (!result.success) {
    throw new Error('Failed to create org');
  }

  const org = result.value;
  (org as any).props.id = id;

  if (archived) {
    org.archive();
  }

  return org;
}

// Mock repositories
function createMockJoinTokenRepo(): {
  findByToken: ReturnType<typeof vi.fn>;
  tryIncrementUseCount: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  findByOrganizationId: ReturnType<typeof vi.fn>;
} {
  return {
    findByToken: vi.fn(),
    tryIncrementUseCount: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    save: vi.fn(),
    findByOrganizationId: vi.fn(),
  };
}

function createMockOrgRepo(): OrganizationRepository {
  return {
    findById: vi.fn(),
    save: vi.fn(),
    findByName: vi.fn(),
    findByCreatorId: vi.fn(),
    findByParentId: vi.fn(),
    getAncestorIds: vi.fn(),
    getDescendantIds: vi.fn(),
    getFullTreeOrgIds: vi.fn(),
    isUserMember: vi.fn(),
    isUserAdmin: vi.fn(),
    findMembershipsByUserId: vi.fn(),
    findAdminOrganizationsByUserId: vi.fn(),
    findAllWithStats: vi.fn(),
    searchOrganizationsWithStats: vi.fn(),
    update: vi.fn(),
    findAcceptedMemberUserIdsIncludingDescendants: vi.fn(),
    removeUserFromOrganization: vi.fn(),
    findPendingRequestsByUserId: vi.fn(),
    getAncestors: vi.fn(),
    getChildrenWithStats: vi.fn(),
    getHierarchyTree: vi.fn(),
    findAdminUserIds: vi.fn(),
    setParentId: vi.fn(),
    searchByNameFuzzy: vi.fn(),
    addAdmin: vi.fn().mockResolvedValue(undefined),
    removeAdmin: vi.fn(),
  };
}

function createMockJoinOrgUseCase(): { execute: ReturnType<typeof vi.fn> } {
  return {
    execute: vi.fn(),
  };
}

describe('UseJoinTokenUseCase', () => {
  let useCase: UseJoinTokenUseCase;
  let joinTokenRepo: ReturnType<typeof createMockJoinTokenRepo>;
  let orgRepo: ReturnType<typeof createMockOrgRepo>;
  let joinOrgUseCase: ReturnType<typeof createMockJoinOrgUseCase>;

  beforeEach(() => {
    joinTokenRepo = createMockJoinTokenRepo();
    orgRepo = createMockOrgRepo();
    joinOrgUseCase = createMockJoinOrgUseCase();

    useCase = new UseJoinTokenUseCase({
      joinTokenRepository: joinTokenRepo as unknown as JoinTokenRepository,
      organizationRepository: orgRepo as unknown as OrganizationRepository,
      joinOrganizationUseCase:
        joinOrgUseCase as unknown as JoinOrganizationUseCase,
    });
  });

  it('should succeed with valid token', async () => {
    const token = createMockJoinToken();
    const org = createMockOrg('org-123');

    joinTokenRepo.findByToken.mockResolvedValue(token);
    (orgRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(org);
    joinTokenRepo.tryIncrementUseCount.mockResolvedValue(true);
    joinOrgUseCase.execute.mockResolvedValue(success(undefined));

    const result = await useCase.execute('abc123defg', 'user-1');

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual({ organizationId: 'org-123' });
    }

    expect(joinTokenRepo.findByToken).toHaveBeenCalledWith('abc123defg');
    expect(joinTokenRepo.tryIncrementUseCount).toHaveBeenCalledWith(
      'token-id-1'
    );
    expect(joinOrgUseCase.execute).toHaveBeenCalledWith(
      { organizationId: 'org-123', joinTokenId: 'token-id-1' },
      'user-1'
    );
  });

  it('should fail when token not found', async () => {
    joinTokenRepo.findByToken.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent', 'user-1');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenErrors.NOT_FOUND);
    }
  });

  it('should fail when token expired', async () => {
    const token = createMockJoinToken({ expiredAt: new Date() });
    joinTokenRepo.findByToken.mockResolvedValue(token);

    const result = await useCase.execute('abc123defg', 'user-1');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenErrors.EXPIRED);
    }
  });

  it('should fail when token exhausted (tryIncrementUseCount returns false)', async () => {
    const token = createMockJoinToken();
    const org = createMockOrg('org-123');

    joinTokenRepo.findByToken.mockResolvedValue(token);
    (orgRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(org);
    joinTokenRepo.tryIncrementUseCount.mockResolvedValue(false);

    const result = await useCase.execute('abc123defg', 'user-1');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(JoinTokenErrors.EXHAUSTED);
    }
  });

  it('should fail when org not found', async () => {
    const token = createMockJoinToken();

    joinTokenRepo.findByToken.mockResolvedValue(token);
    (orgRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await useCase.execute('abc123defg', 'user-1');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_FOUND);
    }
  });

  it('should fail when org archived', async () => {
    const token = createMockJoinToken();
    const org = createMockOrg('org-123', true);

    joinTokenRepo.findByToken.mockResolvedValue(token);
    (orgRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(org);

    const result = await useCase.execute('abc123defg', 'user-1');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.ARCHIVED);
    }
  });

  it('should rollback useCount when JoinOrganizationUseCase fails', async () => {
    const token = createMockJoinToken({ useCount: 3 });
    const org = createMockOrg('org-123');

    joinTokenRepo.findByToken.mockResolvedValue(token);
    (orgRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(org);
    joinTokenRepo.tryIncrementUseCount.mockResolvedValue(true);
    joinOrgUseCase.execute.mockResolvedValue(
      failure(OrganizationErrors.ALREADY_MEMBER)
    );

    // For rollback: findById returns the token with incremented count, update succeeds
    const incrementedToken = createMockJoinToken({ useCount: 4 });
    joinTokenRepo.findById.mockResolvedValue(incrementedToken);
    joinTokenRepo.update.mockResolvedValue(incrementedToken);

    const result = await useCase.execute('abc123defg', 'user-1');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.ALREADY_MEMBER);
    }

    // Verify rollback was attempted
    expect(joinTokenRepo.findById).toHaveBeenCalledWith('token-id-1');
    expect(joinTokenRepo.update).toHaveBeenCalled();
  });

  it('should still return join error when rollback fails', async () => {
    const token = createMockJoinToken();
    const org = createMockOrg('org-123');

    joinTokenRepo.findByToken.mockResolvedValue(token);
    (orgRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(org);
    joinTokenRepo.tryIncrementUseCount.mockResolvedValue(true);
    joinOrgUseCase.execute.mockResolvedValue(
      failure(OrganizationErrors.ALREADY_MEMBER)
    );

    // Rollback fails
    joinTokenRepo.findById.mockRejectedValue(new Error('DB error'));

    const result = await useCase.execute('abc123defg', 'user-1');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.ALREADY_MEMBER);
    }
  });
});
