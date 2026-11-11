/** Configuration persistence distinguishes missing settings from explicit read/write failures.
 * Validated key/value alternatives stay in the core; adapters translate storage exceptions. */
import { SystemSetting, SystemSettingKey } from './SystemSetting';
import type { Result } from '../shared/Result';
import type { SystemSettingValidationError } from './SystemSetting';
export type SystemSettingReadError = 'common.errors.unexpected';
export type SystemSettingWriteError =
  | SystemSettingReadError
  | SystemSettingValidationError;
export interface SystemSettingRepository {
  get(
    key: SystemSettingKey
  ): Promise<Result<SystemSetting | null, SystemSettingReadError>>;
  set(setting: SystemSetting): Promise<Result<void, SystemSettingWriteError>>;
}
