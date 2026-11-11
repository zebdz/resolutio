/** Reads a key-specific configuration value through the core port.
 * Only absent rows use defaults; failures and mismatched keys remain explicit. */
import {
  defaultSetting,
  type SystemSetting,
  type SystemSettingKey,
} from '@/domain/systemSetting/SystemSetting';
import type {
  SystemSettingRepository,
  SystemSettingReadError,
} from '@/domain/systemSetting/SystemSettingRepository';
import { failure, success, type Result } from '@/domain/shared/Result';

type SettingForKey<Key extends SystemSettingKey> = Extract<
  SystemSetting,
  { key: Key }
>;

function matchesKey<Key extends SystemSettingKey>(
  setting: SystemSetting,
  key: Key
): setting is SettingForKey<Key> {
  return setting.key === key;
}

export async function readSystemSetting<Key extends SystemSettingKey>(
  repository: Pick<SystemSettingRepository, 'get'>,
  key: Key
): Promise<Result<SettingForKey<Key>, SystemSettingReadError>> {
  const stored = await repository.get(key);

  if (!stored.success) {
    return stored;
  }

  const setting = stored.value ?? defaultSetting(key);

  if (!matchesKey(setting, key)) {
    return failure('common.errors.unexpected');
  }

  return success(setting);
}
