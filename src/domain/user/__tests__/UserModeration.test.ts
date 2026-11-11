/** Moderation records validate identities/reasons and preserve exact audit text.
 * Historical display reasons permit legacy empty text without weakening new commands. */
import { expect, it } from 'vitest';
import {
  createUserModerationEntry,
  UserBlockEntryId,
  UserModerationReason,
  UserModerationReasonSnapshot,
} from '../UserModeration';
import { UserId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
const creation = {
  id: UserBlockEntryId.parse('entry-1'),
  now: Instant.parse('2026-11-04T12:00:00.000Z'),
};
const input = {
  userId: UserId.parse('target'),
  actorId: UserId.parse('admin'),
  status: 'blocked' as const,
  reason: '  Spam report  ',
};
it('retains supplied identity/time and exact nonblank reason bytes', () => {
  const result = createUserModerationEntry(input, creation);
  expect(result).toEqual({
    success: true,
    value: { ...input, id: creation.id, createdAt: creation.now },
  });

  if (result.success) {
    expect(Object.isFrozen(result.value)).toBe(true);
  }
});
it.each(['', '  ', '\n'])('rejects blank new reason %j', (reason) => {
  expect(createUserModerationEntry({ ...input, reason }, creation)).toEqual({
    success: false,
    error: 'superadmin.users.reasonRequired',
  });
});
it('applies the supplied profanity policy before recording a decision', () => {
  expect(
    createUserModerationEntry(input, creation, {
      containsProfanity: () => true,
      findProfaneWords: () => [],
    })
  ).toEqual({ success: false, error: 'domain.shared.containsProfanity' });
});
it('rejects invalid identity or decision data explicitly', () => {
  expect(createUserModerationEntry({ ...input, userId: '' }, creation)).toEqual(
    { success: false, error: 'common.errors.validationFailed' }
  );
  expect(
    createUserModerationEntry({ ...input, status: 'unknown' }, creation)
  ).toEqual({ success: false, error: 'common.errors.validationFailed' });
});
it('preserves legacy historical reason text separately from new-reason constraints', () => {
  expect(UserModerationReasonSnapshot.parse('')).toBe('');
  expect(UserModerationReason.safeParse('').success).toBe(false);
});
it('validates the audit identity contract', () => {
  for (const value of [
    'cuid123',
    'legacy-1',
    '550e8400-e29b-41d4-a716-446655440000',
  ]) {
    expect(UserBlockEntryId.safeParse(value).success).toBe(true);
  }

  for (const value of ['', 'bad id', '/path', 'x'.repeat(257)]) {
    expect(UserBlockEntryId.safeParse(value).success).toBe(false);
  }
});
