import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCurrentUser = vi.fn();
const mockIsSuperAdmin = vi.fn();

vi.mock('@/web/lib/session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaUserRepository: class {
    isSuperAdmin = mockIsSuperAdmin;
  },
}));

const { requireSuperadminApi } = await import('../superadminApiAuth');

describe('requireSuperadminApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no user session', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const result = await requireSuperadminApi();

    expect(result.userId).toBe('');
    expect(result.error).not.toBeNull();
    expect(result.error!.status).toBe(401);
  });

  it('returns 403 when user is not superadmin', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockIsSuperAdmin.mockResolvedValue(false);

    const result = await requireSuperadminApi();

    expect(result.userId).toBe('');
    expect(result.error).not.toBeNull();
    expect(result.error!.status).toBe(403);
  });

  it('returns userId and no error when superadmin', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockIsSuperAdmin.mockResolvedValue(true);

    const result = await requireSuperadminApi();

    expect(result.error).toBeNull();
    expect(result.userId).toBe('user-1');
  });
});
