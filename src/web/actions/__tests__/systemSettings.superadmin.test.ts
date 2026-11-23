/** Settings reads/writes preserve units, defaults, authorization and explicit failures.
 * Wrong keys, failed persistence and invalid updates never become successful responses. */
import { beforeEach, expect, it, vi } from 'vitest';
import { success, failure } from '@/domain/shared/Result';
import { SystemSetting } from '@/domain/systemSetting/SystemSetting';
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  auth: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock('@/infrastructure/index', () => ({ prisma: {} }));
vi.mock('@/infrastructure/repositories/PrismaSystemSettingRepository', () => ({
  PrismaSystemSettingRepository: class {
    get = mocks.get;
    set = mocks.set;
  },
}));
vi.mock('@/src/web/actions/superadmin/superadminAuth', () => ({
  requireSuperadmin: mocks.auth,
}));
vi.mock('@/web/actions/rateLimit', () => ({ checkRateLimit: mocks.rateLimit }));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) => `translated:${code}`,
}));
const { getSystemSettingsAction, updateSystemSettingAction } =
  await import('../superadmin/systemSettings');

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rateLimit.mockResolvedValue(null);
  mocks.set.mockResolvedValue(success(undefined));
  mocks.auth.mockResolvedValue({ userId: 'admin' });
  mocks.get.mockResolvedValue(success(null));
});

it('rejects a setting returned for the wrong key', async () => {
  mocks.get.mockResolvedValue(
    success(
      SystemSetting.parse({
        key: 'legal_check_daily_token_cap',
        value: 100_000,
      })
    )
  );

  expect(await getSystemSettingsAction()).toEqual({
    success: false,
    error: 'translated:common.errors.unexpected',
  });
});

it('returns established defaults for absent settings', async () => {
  expect(await getSystemSettingsAction()).toEqual({
    success: true,
    data: {
      legalCheckMaxPerAdminPerHour: 10,
      legalCheckDailyTokenCap: 100_000,
      legalCheckMinOrgSize: 3,
    },
  });
});

it('preserves stored values and zero-disabled gates', async () => {
  mocks.get.mockImplementation(async (key: string) =>
    success(
      SystemSetting.parse({
        key,
        value: key === 'legal_check_max_per_admin_per_hour' ? 25 : 0,
      })
    )
  );

  expect(await getSystemSettingsAction()).toEqual({
    success: true,
    data: {
      legalCheckMaxPerAdminPerHour: 25,
      legalCheckDailyTokenCap: 0,
      legalCheckMinOrgSize: 0,
    },
  });
});

it('rejects unauthorized readers before accessing settings', async () => {
  mocks.auth.mockResolvedValue({ success: false, error: 'unauthorized' });

  expect(await getSystemSettingsAction()).toEqual({
    success: false,
    error: 'unauthorized',
  });
  expect(mocks.get).not.toHaveBeenCalled();
});

it('returns rate limiting before authorization or settings reads', async () => {
  mocks.rateLimit.mockResolvedValue({ success: false, error: 'limited' });

  expect(await getSystemSettingsAction()).toEqual({
    success: false,
    error: 'limited',
  });
  expect(mocks.auth).not.toHaveBeenCalled();
  expect(mocks.get).not.toHaveBeenCalled();
});

it('propagates repository read failures instead of defaulting', async () => {
  mocks.get.mockResolvedValue(failure('common.errors.unexpected'));
  expect(await getSystemSettingsAction()).toEqual({
    success: false,
    error: 'translated:common.errors.unexpected',
  });
});
it('propagates failed writes instead of reporting success', async () => {
  mocks.set.mockResolvedValue(failure('common.errors.unexpected'));
  expect(
    await updateSystemSettingAction('legal_check_daily_token_cap', '0')
  ).toEqual({ success: false, error: 'translated:common.errors.unexpected' });
});
it('rejects invalid input before persistence', async () => {
  expect(
    await updateSystemSettingAction('legal_check_daily_token_cap', '3oops')
  ).toEqual({
    success: false,
    error: 'translated:common.errors.validationFailed',
  });
  expect(mocks.set).not.toHaveBeenCalled();
});
it('writes a validated zero and reports success', async () => {
  expect(
    await updateSystemSettingAction('legal_check_daily_token_cap', '0')
  ).toEqual({ success: true, data: undefined });
  expect(mocks.set).toHaveBeenCalledWith(
    SystemSetting.parse({ key: 'legal_check_daily_token_cap', value: 0 })
  );
});
