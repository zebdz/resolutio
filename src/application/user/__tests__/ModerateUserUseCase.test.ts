/** Moderation clients must be authorized before an immutable audit entry is appended.
 * Invalid commands and persistence failures remain explicit and do not report success. */
import { expect, it, vi } from 'vitest';
import { Instant } from '@/domain/shared/Instant';
import { failure, success } from '@/domain/shared/Result';
import { ModerateUserUseCase } from '../ModerateUserUseCase';
const at = Instant.parse('2026-11-04T12:00:00.000Z');

function fixture() {
  const append = vi.fn().mockResolvedValue(success(undefined));
  const isSuperAdmin = vi.fn().mockResolvedValue(true);
  const useCase = new ModerateUserUseCase({
    ids: { generate: (schema) => schema.parse('entry-1') },
    clock: { now: () => at },
    userRepository: { isSuperAdmin },
    moderationRepository: { append },
    profanityChecker: {
      containsProfanity: (text) => text.includes('badword'),
      findProfaneWords: () => [],
    },
  });

  return { append, isSuperAdmin, useCase };
}

const input = {
  userId: 'target',
  actorId: 'admin',
  status: 'blocked',
  reason: ' Spam ',
};
it.each(['blocked', 'unblocked'])(
  'appends an authorized %s decision with supplied identity/time',
  async (status) => {
    const { append, useCase } = fixture();
    expect(await useCase.execute({ ...input, status })).toEqual(
      success(undefined)
    );
    expect(append).toHaveBeenCalledWith({
      ...input,
      status,
      id: 'entry-1',
      createdAt: at,
    });
  }
);
it('rejects a non-superadmin before persistence', async () => {
  const { append, isSuperAdmin, useCase } = fixture();
  isSuperAdmin.mockResolvedValue(false);
  expect(await useCase.execute(input)).toEqual(
    failure('common.errors.unauthorized')
  );
  expect(append).not.toHaveBeenCalled();
});
it.each([
  { userId: '' },
  { actorId: '' },
  { reason: '  ' },
  { reason: 'badword' },
  { status: 'unknown' },
])('rejects malformed command %j before persistence', async (bad) => {
  const { append, useCase } = fixture();
  expect((await useCase.execute({ ...input, ...bad })).success).toBe(false);
  expect(append).not.toHaveBeenCalled();
});
it('propagates a failed append', async () => {
  const { append, useCase } = fixture();
  append.mockResolvedValue(failure('common.errors.unexpected'));
  expect(await useCase.execute(input)).toEqual(
    failure('common.errors.unexpected')
  );
});
