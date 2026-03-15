import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('version utilities', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('getVersionNumber', () => {
    it('returns NEXT_PUBLIC_APP_VERSION from env', async () => {
      vi.stubEnv('NEXT_PUBLIC_APP_VERSION', 'v1.2.3-abc1234');
      const { getVersionNumber } = await import('../version');
      expect(getVersionNumber()).toBe('v1.2.3-abc1234');
    });

    it('returns "unknown" when env not set', async () => {
      vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '');
      const { getVersionNumber } = await import('../version');
      expect(getVersionNumber()).toBe('unknown');
    });
  });

  describe('getVersionTimestamp', () => {
    it('returns NEXT_PUBLIC_BUILD_ID from env', async () => {
      vi.stubEnv('NEXT_PUBLIC_BUILD_ID', '3-14-2026, 12:00:00 PM');
      const { getVersionTimestamp } = await import('../version');
      expect(getVersionTimestamp()).toBe('3-14-2026, 12:00:00 PM');
    });

    it('returns "unknown" when env not set', async () => {
      vi.stubEnv('NEXT_PUBLIC_BUILD_ID', '');
      const { getVersionTimestamp } = await import('../version');
      expect(getVersionTimestamp()).toBe('unknown');
    });
  });

  describe('getVersion', () => {
    it('returns combined version and timestamp', async () => {
      vi.stubEnv('NEXT_PUBLIC_APP_VERSION', 'v1.0.0-abc');
      vi.stubEnv('NEXT_PUBLIC_BUILD_ID', '3-14-2026, 12:00:00 PM');
      const { getVersion } = await import('../version');
      expect(getVersion()).toBe('v1.0.0-abc (3-14-2026, 12:00:00 PM)');
    });

    it('handles missing values gracefully', async () => {
      vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '');
      vi.stubEnv('NEXT_PUBLIC_BUILD_ID', '');
      const { getVersion } = await import('../version');
      expect(getVersion()).toBe('unknown (unknown)');
    });
  });
});
