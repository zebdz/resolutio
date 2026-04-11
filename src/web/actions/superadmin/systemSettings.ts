'use server';

import { checkRateLimit } from '@/web/actions/rateLimit';
import { requireSuperadmin } from '@/src/web/actions/superadmin/superadminAuth';
import { isError } from '@/src/web/actions/superadmin/superadminAuthUtils';
import { prisma } from '@/infrastructure/index';
import { PrismaSystemSettingRepository } from '@/infrastructure/repositories/PrismaSystemSettingRepository';

const systemSettingRepository = new PrismaSystemSettingRepository(prisma);

// Per-key bounds. `0 = disabled` semantic for cap/size gates.
// Hourly limit has min 1 to prevent locking all admins out via setting=0.
const LEGAL_CHECK_SETTINGS = {
  legal_check_max_per_admin_per_hour: { default: 10, min: 1, max: 1000 },
  legal_check_daily_token_cap: { default: 100_000, min: 0, max: 10_000_000 },
  legal_check_min_org_size: { default: 3, min: 0, max: 10_000 },
} as const;

type LegalCheckSettingKey = keyof typeof LEGAL_CHECK_SETTINGS;

export interface LegalCheckSettings {
  legalCheckMaxPerAdminPerHour: number;
  legalCheckDailyTokenCap: number;
  legalCheckMinOrgSize: number;
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

async function readNumeric(key: LegalCheckSettingKey): Promise<number> {
  const raw = await systemSettingRepository.get(key);
  const fallback = LEGAL_CHECK_SETTINGS[key].default;

  if (raw === null) {
    return fallback;
  }

  const parsed = parseInt(raw, 10);

  return Number.isFinite(parsed) ? parsed : fallback;
}

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

  return {
    success: true,
    data: {
      legalCheckMaxPerAdminPerHour: await readNumeric(
        'legal_check_max_per_admin_per_hour'
      ),
      legalCheckDailyTokenCap: await readNumeric('legal_check_daily_token_cap'),
      legalCheckMinOrgSize: await readNumeric('legal_check_min_org_size'),
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

  if (!(key in LEGAL_CHECK_SETTINGS)) {
    return { success: false, error: 'Invalid setting key' };
  }

  const bounds = LEGAL_CHECK_SETTINGS[key as LegalCheckSettingKey];

  const numValue = parseInt(value, 10);

  if (
    !Number.isFinite(numValue) ||
    numValue < bounds.min ||
    numValue > bounds.max
  ) {
    return {
      success: false,
      error: `Value must be between ${bounds.min} and ${bounds.max}`,
    };
  }

  await systemSettingRepository.set(key, String(numValue));

  return { success: true, data: undefined };
}
