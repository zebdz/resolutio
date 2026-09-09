import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';

import {
  limiterRegistry,
  getLimiterByLabel,
  middlewareSessionLimiter,
  middlewareIpLimiter,
  serverActionSessionLimiter,
  serverActionIpLimiter,
  addressSuggestLimiter,
} from '../registry';

describe('limiterRegistry', () => {
  it('has 10 entries with unique labels', () => {
    expect(limiterRegistry).toHaveLength(10);
    const labels = limiterRegistry.map((e) => e.label);
    expect(new Set(labels).size).toBe(10);
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
    // Guards the positional-export risk directly: named exports are derived
    // by array index, so inserting an entry anywhere but the end would
    // silently repoint every export after it.
    expect(addressSuggestLimiter).toBe(limiterRegistry[9].limiter);
  });
});

describe('limiterRegistry labels', () => {
  // The superadmin pages render tLabels(entry.label); a label without a
  // translation shows up as the raw key path.
  it.each([
    ['en', en],
    ['ru', ru],
  ])('every registry label is translated in %s', (_lang, messages) => {
    const labels: Record<string, string> =
      messages.superadmin.rateLimits.labels;

    for (const entry of limiterRegistry) {
      expect(labels[entry.label], `label "${entry.label}"`).toBeDefined();
    }
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

  it('reportCreate configured at 10 per 24 h', () => {
    const entry = getLimiterByLabel('reportCreate');
    expect(entry).toBeDefined();
    expect(entry!.maxRequests).toBe(10);
    expect(entry!.windowMs).toBe(24 * 60 * 60_000);
  });

  it('addressSuggest configured at 9,500 per day (daily quota, not per-minute)', () => {
    const entry = getLimiterByLabel('addressSuggest');
    expect(entry).toBeDefined();
    expect(entry!.maxRequests).toBe(9_500);
    expect(entry!.windowMs).toBe(24 * 60 * 60_000);
  });
});
