/** Configuration storage returns explicit failures for invalid rows and database errors.
 * Valid writes preserve the existing string representation without exposing driver errors. */
import { expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { SystemSetting } from '@/domain/systemSetting/SystemSetting';
import { PrismaSystemSettingRepository } from '../PrismaSystemSettingRepository';

function fixture() {
  const findUnique = vi.fn();
  const upsert = vi.fn().mockResolvedValue({});
  const repo = new PrismaSystemSettingRepository({
    systemSetting: { findUnique, upsert },
  } as unknown as PrismaClient);

  return { findUnique, upsert, repo };
}

it('distinguishes missing settings from malformed numeric values', async () => {
  const { findUnique, repo } = fixture();
  findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
    key: 'legal_check_daily_token_cap',
    value: '3oops',
  });
  expect(await repo.get('legal_check_daily_token_cap')).toEqual({
    success: true,
    value: null,
  });
  expect(await repo.get('legal_check_daily_token_cap')).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
});
it('rejects a stored row for the wrong key', async () => {
  const { findUnique, repo } = fixture();
  findUnique.mockResolvedValue({
    key: 'legal_check_daily_token_cap',
    value: '10',
  });
  expect(await repo.get('legal_check_min_org_size')).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
});
it('returns a validated stored zero', async () => {
  const { findUnique, repo } = fixture();
  findUnique.mockResolvedValue({
    key: 'legal_check_daily_token_cap',
    value: '0',
  });
  expect(await repo.get('legal_check_daily_token_cap')).toEqual({
    success: true,
    value: { key: 'legal_check_daily_token_cap', value: 0 },
  });
});
it('returns stable failures for database read and write errors', async () => {
  const { findUnique, upsert, repo } = fixture();
  findUnique.mockRejectedValue(new Error('private database error'));
  upsert.mockRejectedValue(new Error('private database error'));
  expect(await repo.get('legal_check_daily_token_cap')).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
  expect(
    await repo.set(
      SystemSetting.parse({ key: 'legal_check_daily_token_cap', value: 0 })
    )
  ).toEqual({ success: false, error: 'common.errors.unexpected' });
});
it('persists the exact numeric storage string', async () => {
  const { upsert, repo } = fixture();
  expect(
    await repo.set(
      SystemSetting.parse({ key: 'legal_check_daily_token_cap', value: 0 })
    )
  ).toEqual({ success: true, value: undefined });
  expect(upsert).toHaveBeenCalledWith({
    where: { key: 'legal_check_daily_token_cap' },
    create: { key: 'legal_check_daily_token_cap', value: '0' },
    update: { value: '0' },
  });
});
it('rejects unchecked invalid values before writing', async () => {
  const { upsert, repo } = fixture();
  const result = await repo.set({
    key: 'legal_check_daily_token_cap',
    // @ts-expect-error Deliberately invalid untrusted input exercises the runtime boundary.
    value: -1,
  });
  expect(result).toEqual({
    success: false,
    error: 'common.errors.validationFailed',
  });
  expect(upsert).not.toHaveBeenCalled();
});
