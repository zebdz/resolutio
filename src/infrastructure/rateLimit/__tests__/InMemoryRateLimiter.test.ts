import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  InMemoryRateLimiter,
  type RateLimitResult,
} from '../InMemoryRateLimiter';

describe('InMemoryRateLimiter', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    limiter?.destroy();
    vi.useRealTimers();
  });

  it('allows requests under the limit', () => {
    limiter = new InMemoryRateLimiter(5, 60_000);

    const result = limiter.check('192.168.1.1');

    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it('returns correct remaining count', () => {
    limiter = new InMemoryRateLimiter(5, 60_000);

    expect(limiter.check('192.168.1.1').remaining).toBe(4);
    expect(limiter.check('192.168.1.1').remaining).toBe(3);
    expect(limiter.check('192.168.1.1').remaining).toBe(2);
    expect(limiter.check('192.168.1.1').remaining).toBe(1);
    expect(limiter.check('192.168.1.1').remaining).toBe(0);
  });

  it('blocks at exactly maxRequests + 1', () => {
    limiter = new InMemoryRateLimiter(3, 60_000);

    limiter.check('192.168.1.1');
    limiter.check('192.168.1.1');
    const lastAllowed = limiter.check('192.168.1.1');
    const blocked = limiter.check('192.168.1.1');

    expect(lastAllowed.allowed).toBe(true);
    expect(lastAllowed.remaining).toBe(0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('returns correct retryAfterSeconds when blocked', () => {
    limiter = new InMemoryRateLimiter(2, 60_000);

    limiter.check('192.168.1.1');
    limiter.check('192.168.1.1');

    // Advance 20s
    vi.advanceTimersByTime(20_000);

    const blocked = limiter.check('192.168.1.1');

    expect(blocked.allowed).toBe(false);
    // Oldest request was at t=0, window is 60s, so retryAfter ~= 40s
    expect(blocked.retryAfterSeconds).toBe(40);
  });

  it('allows requests again after window expires', () => {
    limiter = new InMemoryRateLimiter(2, 60_000);

    limiter.check('192.168.1.1');
    limiter.check('192.168.1.1');
    expect(limiter.check('192.168.1.1').allowed).toBe(false);

    // Advance past window
    vi.advanceTimersByTime(60_001);

    const result = limiter.check('192.168.1.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('cleanup removes stale entries', () => {
    limiter = new InMemoryRateLimiter(2, 60_000);

    limiter.check('192.168.1.1');
    limiter.check('192.168.1.1');

    // Advance past window
    vi.advanceTimersByTime(60_001);

    limiter.cleanup();

    // Should be fresh — allow full limit again
    expect(limiter.check('192.168.1.1').remaining).toBe(1);
    expect(limiter.check('192.168.1.1').remaining).toBe(0);
  });

  it('cleanup deletes keys with no timestamps', () => {
    limiter = new InMemoryRateLimiter(2, 60_000);

    limiter.check('192.168.1.1');

    vi.advanceTimersByTime(60_001);
    limiter.cleanup();

    // Internal store should have no keys — verify via a fresh check
    expect(limiter.check('192.168.1.1').remaining).toBe(1);
  });

  it('destroy stops cleanup interval', () => {
    limiter = new InMemoryRateLimiter(2, 60_000, 10_000);

    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    limiter.destroy();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('tracks different keys independently', () => {
    limiter = new InMemoryRateLimiter(2, 60_000);

    limiter.check('192.168.1.1');
    limiter.check('192.168.1.1');
    expect(limiter.check('192.168.1.1').allowed).toBe(false);

    // Different IP should still be allowed
    const result = limiter.check('10.0.0.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  describe('size', () => {
    it('returns 0 when empty', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);
      expect(limiter.size).toBe(0);
    });

    it('returns correct count after adds', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);
      limiter.check('a');
      limiter.check('b');
      limiter.check('c');
      expect(limiter.size).toBe(3);
    });

    it('excludes expired keys', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);
      limiter.check('a');
      limiter.check('b');

      vi.advanceTimersByTime(60_001);
      limiter.check('c');

      expect(limiter.size).toBe(1);
    });
  });

  describe('getEntries', () => {
    it('returns full status per entry', () => {
      limiter = new InMemoryRateLimiter(3, 60_000);
      limiter.check('a');
      limiter.check('a');

      const entries = limiter.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        key: 'a',
        count: 2,
        remaining: 1,
        blocked: false,
        retryAfterSeconds: 0,
      });
    });

    it('filters expired entries', () => {
      limiter = new InMemoryRateLimiter(3, 60_000);
      limiter.check('a');

      vi.advanceTimersByTime(60_001);
      limiter.check('b');

      const entries = limiter.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].key).toBe('b');
    });

    it('blocked=true when at limit', () => {
      limiter = new InMemoryRateLimiter(2, 60_000);
      limiter.check('a');
      limiter.check('a');

      const entries = limiter.getEntries();
      expect(entries[0].blocked).toBe(true);
      expect(entries[0].remaining).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('empties store and size is 0', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);
      limiter.check('a');
      limiter.check('b');

      limiter.clearAll();

      expect(limiter.size).toBe(0);
      expect(limiter.getEntries()).toHaveLength(0);
    });
  });

  describe('searchKeys', () => {
    it('returns substring matches case-insensitively', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);
      limiter.check('user:ABC123');
      limiter.check('user:def456');
      limiter.check('192.168.1.1');

      expect(limiter.searchKeys('user')).toEqual(
        expect.arrayContaining(['user:ABC123', 'user:def456'])
      );
      expect(limiter.searchKeys('user')).toHaveLength(2);
    });

    it('is case-insensitive', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);
      limiter.check('User:ABC');

      expect(limiter.searchKeys('user')).toEqual(['User:ABC']);
      expect(limiter.searchKeys('USER')).toEqual(['User:ABC']);
    });

    it('excludes expired keys', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);
      limiter.check('user:old');

      vi.advanceTimersByTime(60_001);
      limiter.check('user:new');

      expect(limiter.searchKeys('user')).toEqual(['user:new']);
    });

    it('returns empty on no match', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);
      limiter.check('abc');

      expect(limiter.searchKeys('xyz')).toEqual([]);
    });
  });

  describe('getBlockedKeys', () => {
    it('returns only keys at/over limit', () => {
      limiter = new InMemoryRateLimiter(2, 60_000);
      limiter.check('a');
      limiter.check('a');
      limiter.check('b');

      expect(limiter.getBlockedKeys()).toEqual(['a']);
    });

    it('returns empty when none blocked', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);
      limiter.check('a');

      expect(limiter.getBlockedKeys()).toEqual([]);
    });
  });

  describe('resetKeys', () => {
    it('resets specified keys and leaves others', () => {
      limiter = new InMemoryRateLimiter(2, 60_000);
      limiter.check('a');
      limiter.check('a');
      limiter.check('b');
      limiter.check('b');
      limiter.check('c');

      limiter.resetKeys(['a', 'b']);

      expect(limiter.check('a').remaining).toBe(1); // fresh
      expect(limiter.check('b').remaining).toBe(1); // fresh
      expect(limiter.check('c').remaining).toBe(0); // still has 1 prev + this new one = 2
    });
  });

  describe('lockKey', () => {
    it('makes key blocked immediately', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);

      limiter.lockKey('a');

      const result = limiter.peek('a');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('makes existing key blocked', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);
      limiter.check('a'); // 1 hit

      limiter.lockKey('a');

      const result = limiter.peek('a');
      expect(result.allowed).toBe(false);
    });

    it('locked key returns blocked on check', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);

      limiter.lockKey('a');

      const result = limiter.check('a');
      expect(result.allowed).toBe(false);
    });
  });

  describe('onBlocked', () => {
    it('fires on first block', () => {
      limiter = new InMemoryRateLimiter(2, 60_000);
      const callback = vi.fn();
      limiter.onBlocked = callback;

      limiter.check('a');
      limiter.check('a');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('a');
    });

    it('does NOT fire on subsequent attempts in same window', () => {
      limiter = new InMemoryRateLimiter(2, 60_000);
      const callback = vi.fn();
      limiter.onBlocked = callback;

      limiter.check('a');
      limiter.check('a'); // triggers block → fires
      limiter.check('a'); // already blocked → no fire
      limiter.check('a'); // already blocked → no fire

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('fires again after window reset', () => {
      limiter = new InMemoryRateLimiter(2, 60_000);
      const callback = vi.fn();
      limiter.onBlocked = callback;

      limiter.check('a');
      limiter.check('a'); // fires

      vi.advanceTimersByTime(60_001);

      limiter.check('a');
      limiter.check('a'); // fires again

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('does not fire when not at limit', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);
      const callback = vi.fn();
      limiter.onBlocked = callback;

      limiter.check('a');
      limiter.check('a');

      expect(callback).not.toHaveBeenCalled();
    });

    it('fires when lockKey is called', () => {
      limiter = new InMemoryRateLimiter(5, 60_000);
      const callback = vi.fn();
      limiter.onBlocked = callback;

      limiter.lockKey('a');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('a');
    });
  });
});
