/** Configuration values obey per-setting units and existing product bounds. */
import { expect, it } from 'vitest';
import { decodeStoredSetting, SystemSetting } from '../SystemSetting';
it.each([
  ['legal_check_max_per_admin_per_hour', '2abc'],
  ['legal_check_daily_token_cap', ''],
  ['legal_check_daily_token_cap', '   '],
  ['legal_check_daily_token_cap', 'Infinity'],
  ['legal_check_max_per_admin_per_hour', '1.5'],
  ['unknown', '10'],
])('returns an explicit validation failure for %s = %s', (key, value) => {
  expect(decodeStoredSetting(key, value)).toEqual({
    success: false,
    error: 'common.errors.validationFailed',
  });
});
it('decodes a valid setting without changing its value', () => {
  expect(decodeStoredSetting('legal_check_daily_token_cap', '0')).toEqual({
    success: true,
    value: { key: 'legal_check_daily_token_cap', value: 0 },
  });
});
it('preserves existing per-key ranges and zero-disabled settings', () => {
  expect(
    SystemSetting.parse({ key: 'legal_check_daily_token_cap', value: 0 }).value
  ).toBe(0);
  expect(
    SystemSetting.safeParse({
      key: 'legal_check_max_per_admin_per_hour',
      value: 0,
    }).success
  ).toBe(false);
  expect(
    SystemSetting.safeParse({ key: 'legal_check_min_org_size', value: 10001 })
      .success
  ).toBe(false);
});
