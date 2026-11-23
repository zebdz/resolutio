/** Session lifecycle uses explicit immutable time and validates persisted credentials. */
import { describe, expect, it } from 'vitest';
import { Session } from '../Session';
import { SessionId, UserId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';

describe('Session', () => {
  const stored = {
    id: 'session-token',
    userId: 'user-1',
    createdAt: new Date('2026-10-26T10:00:00.000Z'),
    expiresAt: new Date('2026-10-27T10:00:00.000Z'),
    ipAddress: null,
    userAgent: null,
  };

  it('uses the supplied identity and creation time before persistence', () => {
    const now = Instant.fromDate(stored.createdAt);
    const session = Session.create(
      {
        userId: UserId.parse(stored.userId),
        expiresAt: Instant.fromDate(stored.expiresAt),
        ipAddress: null,
        userAgent: null,
      },
      { id: SessionId.parse(stored.id), now }
    );

    expect(session.id).toBe(stored.id);
    expect(session.createdAt).toBe(now);
    expect(session.isExpired(session.expiresAt)).toBe(false);
    expect(session.isExpired(Instant.parse('2026-10-27T10:00:00.001Z'))).toBe(
      true
    );
  });

  it('does not expose or retain mutable dates from persistence', () => {
    const expiresAt = new Date(stored.expiresAt);
    const session = Session.reconstitute({ ...stored, expiresAt });
    expiresAt.setFullYear(2000);

    expect(session.expiresAt).toBe('2026-10-27T10:00:00.000Z');
  });

  it.each(['', 'invalid token'])('rejects invalid stored token %j', (id) => {
    expect(() => Session.reconstitute({ ...stored, id })).toThrow();
  });

  it('rejects an invalid persisted expiry', () => {
    expect(() =>
      Session.reconstitute({ ...stored, expiresAt: new Date(NaN) })
    ).toThrow();
  });
});
