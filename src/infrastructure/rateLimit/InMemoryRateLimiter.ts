export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export class InMemoryRateLimiter {
  private store: Map<string, number[]> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

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

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: this.maxRequests - recent.length,
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

  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.store) {
      const recent = timestamps.filter((t) => t > windowStart);

      if (recent.length === 0) {
        this.store.delete(key);
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
