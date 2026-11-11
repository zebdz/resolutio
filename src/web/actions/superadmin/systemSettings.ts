'use server';

/** Authorized configuration responses retain each setting's validated numeric unit.
 * Application reads preserve key identity; validation and storage failures are translated explicitly. */
import {
  SystemSettingKey,
  decodeStoredSetting,
  type ChecksPerHour,
  type DailyTokenCap,
  type MinimumOrganizationSize,
} from '@/domain/systemSetting/SystemSetting';
import { readSystemSetting } from '@/application/systemSetting/readSystemSetting';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { requireSuperadmin } from '@/src/web/actions/superadmin/superadminAuth';
import { isError } from '@/src/web/actions/superadmin/superadminAuthUtils';
import { prisma } from '@/infrastructure/index';
import { PrismaSystemSettingRepository } from '@/infrastructure/repositories/PrismaSystemSettingRepository';

const systemSettingRepository = new PrismaSystemSettingRepository(prisma);

export interface LegalCheckSettings {
  legalCheckMaxPerAdminPerHour: ChecksPerHour;
  legalCheckDailyTokenCap: DailyTokenCap;
  legalCheckMinOrgSize: MinimumOrganizationSize;
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function getSystemSettingsAction(): Promise<
  ActionResult<LegalCheckSettings>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const [hourly, daily, organizationSize] = await Promise.all([
    readSystemSetting(
      systemSettingRepository,
      'legal_check_max_per_admin_per_hour'
    ),
    readSystemSetting(systemSettingRepository, 'legal_check_daily_token_cap'),
    readSystemSetting(systemSettingRepository, 'legal_check_min_org_size'),
  ]);

  if (!hourly.success) {
    return { success: false, error: await translateErrorCode(hourly.error) };
  }

  if (!daily.success) {
    return { success: false, error: await translateErrorCode(daily.error) };
  }

  if (!organizationSize.success) {
    return {
      success: false,
      error: await translateErrorCode(organizationSize.error),
    };
  }

  return {
    success: true,
    data: {
      legalCheckMaxPerAdminPerHour: hourly.value.value,
      legalCheckDailyTokenCap: daily.value.value,
      legalCheckMinOrgSize: organizationSize.value.value,
    },
  };
}

export async function updateSystemSettingAction(
  key: string,
  value: string
): Promise<ActionResult<undefined>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const parsedKey = SystemSettingKey.safeParse(key);

  if (!parsedKey.success) {
    return {
      success: false,
      error: await translateErrorCode('common.errors.validationFailed'),
    };
  }

  const setting = decodeStoredSetting(parsedKey.data, value);

  if (!setting.success) {
    return { success: false, error: await translateErrorCode(setting.error) };
  }

  const saved = await systemSettingRepository.set(setting.value);

  if (!saved.success) {
    return { success: false, error: await translateErrorCode(saved.error) };
  }

  return { success: true, data: undefined };
}
