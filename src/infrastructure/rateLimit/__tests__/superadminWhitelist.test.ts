import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  registerSuperadminAccess,
  isSuperadminIp,
  isSuperadminUserId,
  isSuperadminSession,
} from '../superadminWhitelist';

describe('superadminWhitelist', () => {
  beforeEach(() => {
    // Reset by re-importing would be complex; instead test with unique values
    // The module uses globalThis so we can't easily reset between tests.
    // We'll use unique IPs/userIds per test.
  });

  it('returns false for unknown IP', () => {
    expect(isSuperadminIp('99.99.99.99')).toBe(false);
  });

  it('returns false for unknown userId', () => {
    expect(isSuperadminUserId('unknown-user-id')).toBe(false);
  });

  it('returns true for registered IP', () => {
    registerSuperadminAccess('10.0.0.1', 'user-1', 'sess-1');
    expect(isSuperadminIp('10.0.0.1')).toBe(true);
  });

  it('returns true for registered userId', () => {
    registerSuperadminAccess('10.0.0.2', 'user-2', 'sess-2');
    expect(isSuperadminUserId('user-2')).toBe(true);
  });

  it('expires IP after TTL', () => {
    registerSuperadminAccess('10.0.0.3', 'user-3', 'sess-3');
    expect(isSuperadminIp('10.0.0.3')).toBe(true);

    // Fast-forward past TTL (1 hour)
    vi.useFakeTimers();
    vi.advanceTimersByTime(60 * 60_000 + 1);

    expect(isSuperadminIp('10.0.0.3')).toBe(false);

    vi.useRealTimers();
  });

  it('userId does not expire (Set-based)', () => {
    registerSuperadminAccess('10.0.0.4', 'user-4', 'sess-4');

    vi.useFakeTimers();
    vi.advanceTimersByTime(60 * 60_000 + 1);

    // userIds are in a Set — they persist
    expect(isSuperadminUserId('user-4')).toBe(true);

    vi.useRealTimers();
  });

  it('re-registration refreshes IP TTL', () => {
    vi.useFakeTimers({ now: Date.now() });

    registerSuperadminAccess('10.0.0.5', 'user-5', 'sess-5');

    // Advance 50 minutes
    vi.advanceTimersByTime(50 * 60_000);

    // Re-register — should extend TTL
    registerSuperadminAccess('10.0.0.5', 'user-5', 'sess-5');

    // Advance another 50 minutes (total 100min from first, 50 from second)
    vi.advanceTimersByTime(50 * 60_000);

    // Should still be valid (second registration was 50min ago, TTL=60min)
    expect(isSuperadminIp('10.0.0.5')).toBe(true);

    vi.useRealTimers();
  });

  describe('session whitelist', () => {
    it('returns false for unknown session', () => {
      expect(isSuperadminSession('unknown-session')).toBe(false);
    });

    it('returns true for registered session', () => {
      registerSuperadminAccess('10.0.0.10', 'user-10', 'sess-10');
      expect(isSuperadminSession('sess-10')).toBe(true);
    });

    it('expires session after TTL', () => {
      registerSuperadminAccess('10.0.0.11', 'user-11', 'sess-11');
      expect(isSuperadminSession('sess-11')).toBe(true);

      vi.useFakeTimers();
      vi.advanceTimersByTime(60 * 60_000 + 1);

      expect(isSuperadminSession('sess-11')).toBe(false);

      vi.useRealTimers();
    });

    it('re-registration refreshes session TTL', () => {
      vi.useFakeTimers({ now: Date.now() });

      registerSuperadminAccess('10.0.0.12', 'user-12', 'sess-12');

      vi.advanceTimersByTime(50 * 60_000);

      registerSuperadminAccess('10.0.0.12', 'user-12', 'sess-12');

      vi.advanceTimersByTime(50 * 60_000);

      expect(isSuperadminSession('sess-12')).toBe(true);

      vi.useRealTimers();
    });

    it('different session on same IP is not whitelisted', () => {
      registerSuperadminAccess('10.0.0.13', 'user-13', 'sess-superadmin');
      expect(isSuperadminSession('sess-regular-user')).toBe(false);
      // But IP is still whitelisted
      expect(isSuperadminIp('10.0.0.13')).toBe(true);
    });
  });
});
