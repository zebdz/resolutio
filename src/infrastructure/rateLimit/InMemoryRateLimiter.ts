export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export class InMemoryRateLimiter {
  private store: Map<string, number[]> = new Map();
  private blockedNotified: Set<string> = new Set();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  onBlocked?: (key: string) => void;

  constructor(
    private readonly maxRequests: number = 60,
    private readonly windowMs: number = 60_000,
    cleanupIntervalMs: number = 60_000
  ) {
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = this.store.get(key) ?? [];
    const recent = timestamps.filter((t) => t > windowStart);

    if (recent.length >= this.maxRequests) {
      const oldestInWindow = recent[0];
      const retryAfterMs = oldestInWindow + this.windowMs - now;
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

      this.store.set(key, recent);

      return {
        allowed: false,
        retryAfterSeconds: Math.max(retryAfterSeconds, 1),
        remaining: 0,
      };
    }

    recent.push(now);
    this.store.set(key, recent);

    const remaining = this.maxRequests - recent.length;

    if (remaining === 0 && this.onBlocked && !this.blockedNotified.has(key)) {
      this.blockedNotified.add(key);
      this.onBlocked(key);
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining,
    };
  }

  /** Check if key would be rate-limited WITHOUT recording a new attempt. */
  peek(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.store.get(key) ?? [];
    const recent = timestamps.filter((t) => t > windowStart);

    if (recent.length >= this.maxRequests) {
      const oldestInWindow = recent[0];
      const retryAfterMs = oldestInWindow + this.windowMs - now;

      return {
        allowed: false,
        retryAfterSeconds: Math.max(Math.ceil(retryAfterMs / 1000), 1),
        remaining: 0,
      };
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: this.maxRequests - recent.length,
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  get size(): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let count = 0;

    for (const [, timestamps] of this.store) {
      if (timestamps.some((t) => t > windowStart)) {
        count++;
      }
    }

    return count;
  }

  getEntries(): Array<{
    key: string;
    count: number;
    remaining: number;
    blocked: boolean;
    retryAfterSeconds: number;
  }> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const result: Array<{
      key: string;
      count: number;
      remaining: number;
      blocked: boolean;
      retryAfterSeconds: number;
    }> = [];

    for (const [key, timestamps] of this.store) {
      const recent = timestamps.filter((t) => t > windowStart);

      if (recent.length === 0) {
        continue;
      }

      const blocked = recent.length >= this.maxRequests;
      let retryAfterSeconds = 0;

      if (blocked) {
        const oldestInWindow = recent[0];
        const retryAfterMs = oldestInWindow + this.windowMs - now;
        retryAfterSeconds = Math.max(Math.ceil(retryAfterMs / 1000), 1);
      }

      result.push({
        key,
        count: recent.length,
        remaining: Math.max(this.maxRequests - recent.length, 0),
        blocked,
        retryAfterSeconds,
      });
    }

    return result;
  }

  clearAll(): void {
    this.store.clear();
    this.blockedNotified.clear();
  }

  searchKeys(substring: string): string[] {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const lower = substring.toLowerCase();
    const result: string[] = [];

    for (const [key, timestamps] of this.store) {
      if (
        key.toLowerCase().includes(lower) &&
        timestamps.some((t) => t > windowStart)
      ) {
        result.push(key);
      }
    }

    return result;
  }

  getBlockedKeys(): string[] {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const result: string[] = [];

    for (const [key, timestamps] of this.store) {
      const recent = timestamps.filter((t) => t > windowStart);

      if (recent.length >= this.maxRequests) {
        result.push(key);
      }
    }

    return result;
  }

  resetKeys(keys: string[]): void {
    for (const key of keys) {
      this.store.delete(key);
      this.blockedNotified.delete(key);
    }
  }

  lockKey(key: string): void {
    const now = Date.now();
    const timestamps = Array.from({ length: this.maxRequests }, () => now);
    this.store.set(key, timestamps);

    if (this.onBlocked && !this.blockedNotified.has(key)) {
      this.blockedNotified.add(key);
      this.onBlocked(key);
    }
  }

  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.store) {
      const recent = timestamps.filter((t) => t > windowStart);

      if (recent.length === 0) {
        this.store.delete(key);
        this.blockedNotified.delete(key);
      } else {
        this.store.set(key, recent);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
