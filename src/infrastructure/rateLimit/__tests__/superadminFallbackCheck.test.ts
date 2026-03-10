import { describe, it, expect, vi, beforeEach } from 'vitest';

import { isSuperadminSession } from '../superadminWhitelist';

const mockFindById = vi.fn();
const mockIsSuperAdmin = vi.fn();

vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaSessionRepository: class {
    findById = mockFindById;
  },
  PrismaUserRepository: class {
    isSuperAdmin = mockIsSuperAdmin;
  },
}));

const { checkSuperadminBySessionFallback } =
  await import('../superadminFallbackCheck');

describe('checkSuperadminBySessionFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when session not found', async () => {
    mockFindById.mockResolvedValue(null);

    const result = await checkSuperadminBySessionFallback(
      'no-session',
      '1.2.3.4'
    );

    expect(result).toBe(false);
  });

  it('returns false when session is expired', async () => {
    mockFindById.mockResolvedValue({
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await checkSuperadminBySessionFallback(
      'expired-sess',
      '1.2.3.4'
    );

    expect(result).toBe(false);
  });

  it('returns false when user is not superadmin', async () => {
    mockFindById.mockResolvedValue({
      userId: 'regular-user',
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockIsSuperAdmin.mockResolvedValue(false);

    const result = await checkSuperadminBySessionFallback(
      'regular-sess',
      '1.2.3.4'
    );

    expect(result).toBe(false);
  });

  it('returns true and registers whitelist when user is superadmin', async () => {
    mockFindById.mockResolvedValue({
      userId: 'superadmin-user',
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockIsSuperAdmin.mockResolvedValue(true);

    const result = await checkSuperadminBySessionFallback(
      'sa-sess-fb',
      '5.6.7.8'
    );

    expect(result).toBe(true);
    expect(isSuperadminSession('sa-sess-fb')).toBe(true);
  });

  it('negative cache: skips DB on repeated non-superadmin checks', async () => {
    mockFindById.mockResolvedValue({
      userId: 'attacker',
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockIsSuperAdmin.mockResolvedValue(false);

    // First call hits DB
    await checkSuperadminBySessionFallback('attacker-sess', '9.9.9.9');
    expect(mockFindById).toHaveBeenCalledTimes(1);

    // Second call uses negative cache — no DB
    await checkSuperadminBySessionFallback('attacker-sess', '9.9.9.9');
    expect(mockFindById).toHaveBeenCalledTimes(1);
  });
});
