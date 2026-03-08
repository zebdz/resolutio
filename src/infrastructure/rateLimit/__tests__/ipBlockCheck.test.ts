import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetAllBlockedIps } = vi.hoisted(() => ({
  mockGetAllBlockedIps: vi.fn(),
}));

vi.mock('@/infrastructure/repositories/IpBlockRepository', () => ({
  IpBlockRepository: class {
    getAllBlockedIps = mockGetAllBlockedIps;
  },
}));

vi.mock('@/infrastructure/database/prisma', () => ({
  prisma: {},
}));

import {
  isIpBlocked,
  refreshBlockedIps,
  invalidateIpBlockCache,
} from '../ipBlockCheck';

describe('ipBlockCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllBlockedIps.mockResolvedValue([]);
    // Reset the cache by invalidating and refreshing
    invalidateIpBlockCache();
  });

  it('returns false for unblocked IP after refresh', async () => {
    mockGetAllBlockedIps.mockResolvedValue(['10.0.0.1']);
    await refreshBlockedIps();

    expect(isIpBlocked('192.168.1.1')).toBe(false);
  });

  it('returns true for blocked IP after refresh', async () => {
    mockGetAllBlockedIps.mockResolvedValue(['192.168.1.1', '10.0.0.1']);
    await refreshBlockedIps();

    expect(isIpBlocked('192.168.1.1')).toBe(true);
    expect(isIpBlocked('10.0.0.1')).toBe(true);
  });

  it('returns false before first refresh (empty cache)', () => {
    expect(isIpBlocked('192.168.1.1')).toBe(false);
  });

  it('invalidateIpBlockCache marks cache as stale so next isIpBlocked triggers refresh', async () => {
    mockGetAllBlockedIps.mockResolvedValue(['192.168.1.1']);
    await refreshBlockedIps();
    expect(isIpBlocked('192.168.1.1')).toBe(true);

    // Unblock the IP
    mockGetAllBlockedIps.mockResolvedValue([]);
    invalidateIpBlockCache();
    await refreshBlockedIps();

    expect(isIpBlocked('192.168.1.1')).toBe(false);
  });
});
