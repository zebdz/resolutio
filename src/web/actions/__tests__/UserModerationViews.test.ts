/** Moderation view formats retain exclusive states and exact legacy reason snapshots.
 * Whitelisted fields alone reach callers, including when source objects carry extra data. */
import { expect, it } from 'vitest';
import { Instant } from '@/domain/shared/Instant';
import { UserModerationReasonSnapshot } from '@/domain/user/UserModeration';
import {
  serializeUserBlockStatus,
  serializeUserBlockStatusIso,
} from '../superadmin/UserModerationViews';
const at = Instant.parse('2026-11-04T12:00:00.000Z');
it('preserves absent and explicitly unblocked states in both formats', () => {
  expect(serializeUserBlockStatus(null)).toBeNull();
  expect(serializeUserBlockStatusIso(null)).toBeNull();
  expect(serializeUserBlockStatus({ blocked: false })).toEqual({
    blocked: false,
  });
  expect(serializeUserBlockStatusIso({ blocked: false })).toEqual({
    blocked: false,
  });
});
it.each(['', ' Reason '])(
  'preserves reason %j and selects only public block fields',
  (text) => {
    const status = {
      blocked: true as const,
      reason: UserModerationReasonSnapshot.parse(text),
      blockedAt: at,
      privateAudit: 'secret',
    };
    const dateView = serializeUserBlockStatus(status);
    const isoView = serializeUserBlockStatusIso(status);
    expect(dateView).toEqual({
      blocked: true,
      reason: text,
      blockedAt: new Date(at),
    });
    expect(isoView).toEqual({ blocked: true, reason: text, blockedAt: at });
    expect(JSON.stringify(dateView)).not.toContain('secret');
    expect(JSON.stringify(isoView)).not.toContain('secret');
  }
);
