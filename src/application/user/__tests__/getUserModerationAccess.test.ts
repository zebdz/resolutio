/** Access checks distinguish blocked users from unavailable moderation state.
 * Missing/unblocked status permits access; storage failures never become permission. */
import { expect, it, vi } from 'vitest';
import { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { failure, success } from '@/domain/shared/Result';
import { getUserModerationAccess } from '../getUserModerationAccess';
it.each([null, { blocked: false }])('permits access for %j', async (status) => {
  const getStatus = vi.fn().mockResolvedValue(success(status));
  expect(
    await getUserModerationAccess({ getStatus }, UserId.parse('user'))
  ).toEqual(success('allowed'));
});
it('denies access for a validated active block', async () => {
  const getStatus = vi.fn().mockResolvedValue(
    success({
      blocked: true,
      blockedAt: Instant.parse('2026-11-04T12:00:00.000Z'),
    })
  );
  expect(
    await getUserModerationAccess({ getStatus }, UserId.parse('user'))
  ).toEqual(success('blocked'));
});
it('propagates failed status reads', async () => {
  const getStatus = vi
    .fn()
    .mockResolvedValue(failure('common.errors.unexpected'));
  expect(
    await getUserModerationAccess({ getStatus }, UserId.parse('user'))
  ).toEqual(failure('common.errors.unexpected'));
});
