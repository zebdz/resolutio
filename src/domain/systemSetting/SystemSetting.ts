/** Legal-check configuration preserves existing product bounds and zero-disabled gates.
 * A setting's key determines its value unit; decoding returns explicit validation failures. */
import { z } from 'zod';
import { failure, success, type Result } from '../shared/Result';
export const ChecksPerHour = z
  .number()
  .int()
  .min(1)
  .max(1000)
  .brand<'ChecksPerHour'>();
export type ChecksPerHour = z.infer<typeof ChecksPerHour>;
export const DailyTokenCap = z
  .number()
  .int()
  .min(0)
  .max(10_000_000)
  .brand<'DailyTokenCap'>();
export type DailyTokenCap = z.infer<typeof DailyTokenCap>;
export const MinimumOrganizationSize = z
  .number()
  .int()
  .min(0)
  .max(10_000)
  .brand<'MinimumOrganizationSize'>();
export type MinimumOrganizationSize = z.infer<typeof MinimumOrganizationSize>;
export const SystemSettingKey = z.enum([
  'legal_check_max_per_admin_per_hour',
  'legal_check_daily_token_cap',
  'legal_check_min_org_size',
]);
export type SystemSettingKey = z.infer<typeof SystemSettingKey>;
export const SystemSetting = z.discriminatedUnion('key', [
  z
    .object({
      key: z.literal('legal_check_max_per_admin_per_hour'),
      value: ChecksPerHour,
    })
    .readonly(),
  z
    .object({
      key: z.literal('legal_check_daily_token_cap'),
      value: DailyTokenCap,
    })
    .readonly(),
  z
    .object({
      key: z.literal('legal_check_min_org_size'),
      value: MinimumOrganizationSize,
    })
    .readonly(),
]);
export type SystemSetting = z.infer<typeof SystemSetting>;

export type SystemSettingValidationError = 'common.errors.validationFailed';

export function decodeStoredSetting(
  key: string,
  value: string
): Result<SystemSetting, SystemSettingValidationError> {
  if (value.trim().length === 0) {
    return failure('common.errors.validationFailed');
  }

  const parsed = SystemSetting.safeParse({ key, value: Number(value) });

  return parsed.success
    ? success(parsed.data)
    : failure('common.errors.validationFailed');
}

export function defaultSetting(key: SystemSettingKey): SystemSetting {
  switch (key) {
    case 'legal_check_max_per_admin_per_hour':
      return SystemSetting.parse({ key, value: 10 });
    case 'legal_check_daily_token_cap':
      return SystemSetting.parse({ key, value: 100_000 });
    case 'legal_check_min_org_size':
      return SystemSetting.parse({ key, value: 3 });
  }
}
