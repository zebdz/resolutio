import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCurrentUser = vi.fn();
const mockIsSuperAdmin = vi.fn();

vi.mock('@/web/lib/session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaOrganizationRepository: class {
    searchOrganizationsWithStats = vi.fn();
  },
  PrismaBoardRepository: class {},
  PrismaUserRepository: class {
    isSuperAdmin = mockIsSuperAdmin;
  },
  PrismaNotificationRepository: class {},
  PrismaInvitationRepository: class {},
  PrismaOrganizationPropertyRepository: class {},
  PrismaPropertyAssetRepository: class {},
}));

vi.mock('@/infrastructure/profanity/LeoProfanityChecker', () => ({
  LeoProfanityChecker: { getInstance: vi.fn().mockReturnValue({}) },
}));

// Mock all use cases
vi.mock('@/application/organization/CreateOrganizationUseCase', () => ({
  CreateOrganizationUseCase: class {},
}));
vi.mock('@/application/organization/SearchOrganizationsUseCase', () => ({
  SearchOrganizationsUseCase: class {},
}));
vi.mock('@/application/organization/ArchiveOrganizationUseCase', () => ({
  ArchiveOrganizationUseCase: class {},
}));
vi.mock('@/application/organization/UnarchiveOrganizationUseCase', () => ({
  UnarchiveOrganizationUseCase: class {},
}));
vi.mock('@/application/organization/ListOrganizationsUseCase', () => ({
  ListOrganizationsUseCase: class {},
}));
vi.mock('@/application/organization/GetAdminOrganizationsUseCase', () => ({
  GetAdminOrganizationsUseCase: class {},
}));
vi.mock('@/application/organization/GetUserOrganizationsUseCase', () => ({
  GetUserOrganizationsUseCase: class {},
}));
vi.mock('@/application/organization/GetPendingRequestsUseCase', () => ({
  GetPendingRequestsUseCase: class {},
}));
vi.mock('@/application/organization/HandleJoinRequestUseCase', () => ({
  HandleJoinRequestUseCase: class {},
}));
vi.mock('@/application/organization/JoinOrganizationUseCase', () => ({
  JoinOrganizationUseCase: class {},
}));
vi.mock('@/application/organization/GetOrganizationDetailsUseCase', () => ({
  GetOrganizationDetailsUseCase: class {},
}));
vi.mock(
  '@/application/organization/GetOrganizationPendingRequestsUseCase',
  () => ({
    GetOrganizationPendingRequestsUseCase: class {},
  })
);
vi.mock('@/application/organization/CancelJoinRequestUseCase', () => ({
  CancelJoinRequestUseCase: class {},
}));
vi.mock('@/application/organization/UpdateOrganizationUseCase', () => ({
  UpdateOrganizationUseCase: class {},
}));
vi.mock('@/application/organization/RemoveOrgAdminUseCase', () => ({
  RemoveOrgAdminUseCase: class {},
}));
vi.mock('@/application/organization/GetOrgAdminsPaginatedUseCase', () => ({
  GetOrgAdminsPaginatedUseCase: class {},
}));

// Mock schemas
vi.mock('@/application/organization/CreateOrganizationSchema', () => ({
  createOrganizationSchema: {},
}));
vi.mock('@/application/organization/ArchiveOrganizationSchema', () => ({
  ArchiveOrganizationSchema: {},
}));
vi.mock('@/application/organization/UnarchiveOrganizationSchema', () => ({
  UnarchiveOrganizationSchema: {},
}));
vi.mock('@/application/organization/HandleJoinRequestSchema', () => ({
  createHandleJoinRequestSchema: vi.fn(),
}));
vi.mock('@/application/organization/JoinOrganizationSchema', () => ({
  JoinOrganizationSchema: {},
}));
vi.mock('@/application/organization/CancelJoinRequestSchema', () => ({
  CancelJoinRequestSchema: {},
}));
vi.mock('@/application/organization/UpdateOrganizationSchema', () => ({
  updateOrganizationSchema: {},
}));

vi.mock('@/domain/notification/Notification', () => ({
  Notification: class {},
}));

vi.mock('@/web/actions/utils/translateZodErrors', () => ({
  translateZodFieldErrors: vi.fn(),
}));

vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: vi.fn(),
}));

const { searchAllOrganizationsAction } =
  await import('../organization/organization');

describe('searchAllOrganizationsAction - superadmin enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated users', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const result = await searchAllOrganizationsAction({
      page: 1,
      pageSize: 10,
    });

    expect(result).toEqual({ success: false, error: 'unauthorized' });
  });

  it('rejects non-superadmin users', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockIsSuperAdmin.mockResolvedValue(false);

    const result = await searchAllOrganizationsAction({
      page: 1,
      pageSize: 10,
    });

    expect(result).toEqual({ success: false, error: 'unauthorized' });
    expect(mockIsSuperAdmin).toHaveBeenCalledWith('user-1');
  });
});
