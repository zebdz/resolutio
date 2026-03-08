import { describe, it, expect } from 'vitest';

import {
  limiterRegistry,
  getLimiterByLabel,
  middlewareLimiter,
  serverActionLimiter,
} from '../registry';

describe('limiterRegistry', () => {
  it('has 6 entries with unique labels', () => {
    expect(limiterRegistry).toHaveLength(6);
    const labels = limiterRegistry.map((e) => e.label);
    expect(new Set(labels).size).toBe(6);
  });

  it('each entry has a limiter instance', () => {
    for (const entry of limiterRegistry) {
      expect(entry.limiter).toBeDefined();
      expect(typeof entry.limiter.check).toBe('function');
    }
  });

  it('stores registry on globalThis for cross-bundle sharing', () => {
    const g = globalThis as unknown as {
      limiterRegistry: unknown;
    };
    expect(g.limiterRegistry).toBe(limiterRegistry);
  });

  it('named exports reference the same instances as registry entries', () => {
    expect(middlewareLimiter).toBe(limiterRegistry[0].limiter);
    expect(serverActionLimiter).toBe(limiterRegistry[1].limiter);
  });
});

describe('getLimiterByLabel', () => {
  it('returns correct entry for valid label', () => {
    const entry = getLimiterByLabel('middleware');
    expect(entry).toBeDefined();
    expect(entry!.label).toBe('middleware');
    expect(entry!.maxRequests).toBe(60);
  });

  it('returns undefined for invalid label', () => {
    expect(getLimiterByLabel('nonexistent')).toBeUndefined();
  });
});
