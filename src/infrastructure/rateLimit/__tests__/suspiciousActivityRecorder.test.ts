import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  extractUserIdFromKey,
  setupSuspiciousActivityRecording,
} from '../suspiciousActivityRecorder';
import type { LimiterEntry } from '../registry';
import { InMemoryRateLimiter } from '../InMemoryRateLimiter';

vi.mock('@/infrastructure/database/prisma', () => ({
  prisma: {
    rateLimitEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { prisma } from '@/infrastructure/database/prisma';

describe('extractUserIdFromKey', () => {
  it('extracts userId from "user:<id>" pattern (phoneSearch)', () => {
    expect(extractUserIdFromKey('user:abc123', 'phoneSearch')).toBe('abc123');
  });

  it('returns null for IP-keyed limiters', () => {
    expect(extractUserIdFromKey('192.168.1.1', 'middleware')).toBeNull();
  });

  it('returns null for session-keyed limiters', () => {
    expect(extractUserIdFromKey('session:xyz', 'serverAction')).toBeNull();
  });

  it('returns null for login keys', () => {
    expect(
      extractUserIdFromKey('login:1.2.3.4:+71234567890', 'login')
    ).toBeNull();
  });

  it('returns null for registration keys', () => {
    expect(
      extractUserIdFromKey('register:1.2.3.4', 'registrationIp')
    ).toBeNull();
    expect(
      extractUserIdFromKey('register:device-uuid', 'registrationDevice')
    ).toBeNull();
  });
});

describe('setupSuspiciousActivityRecording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wires onBlocked callback on each limiter', () => {
    const entries: LimiterEntry[] = [
      {
        label: 'test',
        limiter: new InMemoryRateLimiter(2, 60_000),
        maxRequests: 2,
        windowMs: 60_000,
      },
    ];

    setupSuspiciousActivityRecording(entries);

    expect(entries[0].limiter.onBlocked).toBeDefined();
  });

  it('creates event with correct fields when blocked', async () => {
    const limiter = new InMemoryRateLimiter(2, 60_000);
    const entries: LimiterEntry[] = [
      { label: 'phoneSearch', limiter, maxRequests: 2, windowMs: 60_000 },
    ];

    setupSuspiciousActivityRecording(entries);

    limiter.check('user:abc123');
    limiter.check('user:abc123'); // triggers block

    // Allow async callback to settle
    await vi.waitFor(() => {
      expect(prisma.rateLimitEvent.create).toHaveBeenCalledWith({
        data: {
          key: 'user:abc123',
          limiterLabel: 'phoneSearch',
          userId: 'abc123',
        },
      });
    });
  });

  it('passes null userId for IP-keyed limiters', async () => {
    const limiter = new InMemoryRateLimiter(2, 60_000);
    const entries: LimiterEntry[] = [
      { label: 'middleware', limiter, maxRequests: 2, windowMs: 60_000 },
    ];

    setupSuspiciousActivityRecording(entries);

    limiter.check('192.168.1.1');
    limiter.check('192.168.1.1');

    await vi.waitFor(() => {
      expect(prisma.rateLimitEvent.create).toHaveBeenCalledWith({
        data: {
          key: '192.168.1.1',
          limiterLabel: 'middleware',
          userId: null,
        },
      });
    });
  });

  it('passes correct limiterLabel', async () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    const entries: LimiterEntry[] = [
      { label: 'login', limiter, maxRequests: 1, windowMs: 60_000 },
    ];

    setupSuspiciousActivityRecording(entries);

    limiter.check('login:1.2.3.4:+71234567890');

    await vi.waitFor(() => {
      expect(prisma.rateLimitEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ limiterLabel: 'login' }),
      });
    });
  });
});
