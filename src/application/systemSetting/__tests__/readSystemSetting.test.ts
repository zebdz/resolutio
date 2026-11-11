/** Settings consumers default only absent values and retain key-specific units.
 * Persistence failures and mismatched keys must propagate before quota decisions. */
import { expect, it, vi } from 'vitest';
import { failure, success } from '@/domain/shared/Result';
import { SystemSetting } from '@/domain/systemSetting/SystemSetting';
import { readSystemSetting } from '../readSystemSetting';

it('uses the established default only when a row is absent', async () => {
  const get = vi.fn().mockResolvedValue(success(null));
  expect(await readSystemSetting({ get }, 'legal_check_min_org_size')).toEqual(
    success({ key: 'legal_check_min_org_size', value: 3 })
  );
});
it('propagates a failed read instead of applying a default', async () => {
  const get = vi.fn().mockResolvedValue(failure('common.errors.unexpected'));
  expect(await readSystemSetting({ get }, 'legal_check_min_org_size')).toEqual(
    failure('common.errors.unexpected')
  );
});
it('rejects a setting for a different key', async () => {
  const get = vi
    .fn()
    .mockResolvedValue(
      success(
        SystemSetting.parse({ key: 'legal_check_daily_token_cap', value: 100 })
      )
    );
  expect(await readSystemSetting({ get }, 'legal_check_min_org_size')).toEqual(
    failure('common.errors.unexpected')
  );
});
it('preserves a stored zero instead of replacing it with a default', async () => {
  const value = SystemSetting.parse({
    key: 'legal_check_daily_token_cap',
    value: 0,
  });
  const get = vi.fn().mockResolvedValue(success(value));
  expect(
    await readSystemSetting({ get }, 'legal_check_daily_token_cap')
  ).toEqual(success(value));
});
