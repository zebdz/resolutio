import { describe, it, expect } from 'vitest';

import {
  limiterRegistry,
  getLimiterByLabel,
  middlewareSessionLimiter,
  middlewareIpLimiter,
  serverActionSessionLimiter,
  serverActionIpLimiter,
} from '../registry';

describe('limiterRegistry', () => {
  it('has 8 entries with unique labels', () => {
    expect(limiterRegistry).toHaveLength(8);
    const labels = limiterRegistry.map((e) => e.label);
    expect(new Set(labels).size).toBe(8);
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
    expect(middlewareSessionLimiter).toBe(limiterRegistry[0].limiter);
    expect(middlewareIpLimiter).toBe(limiterRegistry[1].limiter);
    expect(serverActionSessionLimiter).toBe(limiterRegistry[2].limiter);
    expect(serverActionIpLimiter).toBe(limiterRegistry[3].limiter);
  });
});

describe('getLimiterByLabel', () => {
  it('returns correct entry for valid label', () => {
    const entry = getLimiterByLabel('middlewareIp');
    expect(entry).toBeDefined();
    expect(entry!.label).toBe('middlewareIp');
    expect(entry!.maxRequests).toBe(50_000);
  });

  it('returns undefined for invalid label', () => {
    expect(getLimiterByLabel('nonexistent')).toBeUndefined();
  });

  it('registrationIp configured at 5,000/hr', () => {
    const entry = getLimiterByLabel('registrationIp');
    expect(entry).toBeDefined();
    expect(entry!.maxRequests).toBe(5_000);
    expect(entry!.windowMs).toBe(60 * 60_000);
  });
});
