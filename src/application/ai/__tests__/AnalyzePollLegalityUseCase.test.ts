/** Analysis authorization and quota behavior retain defaults, units and superadmin bypasses.
 * Settings failures propagate before related quota queries instead of becoming defaults. */
import { Instant } from '@/domain/shared/Instant';
import { decodeStoredSetting } from '@/domain/systemSetting/SystemSetting';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyzePollLegalityUseCase } from '../AnalyzePollLegalityUseCase';
import { AIErrors } from '../AIErrors';
import type { PollRepository } from '@/domain/poll/PollRepository';
import type { OrganizationRepository } from '@/domain/organization/OrganizationRepository';
import type { LegalCheckRepository } from '@/domain/ai/LegalCheckRepository';
import type { SystemSettingRepository } from '@/domain/systemSetting/SystemSettingRepository';
import type { Poll } from '@/domain/poll/Poll';
import { success, failure } from '@/domain/shared/Result';

function createMockPoll(
  overrides: Partial<{
    id: string;
    organizationId: string;
    isReady: boolean;
  }> = {}
): Poll {
  return {
    id: overrides.id ?? 'poll-1',
    organizationId: overrides.organizationId ?? 'org-1',
    isReady: () => overrides.isReady ?? true,
  } as unknown as Poll;
}

function memberIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `user-${i}`);
}

describe('AnalyzePollLegalityUseCase', () => {
  let useCase: AnalyzePollLegalityUseCase;
  let pollRepository: Partial<PollRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let legalCheckRepository: Partial<LegalCheckRepository>;
  let systemSettingRepository: Partial<SystemSettingRepository>;
  let mockPoll: Poll;

  beforeEach(() => {
    mockPoll = createMockPoll();

    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(mockPoll)),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
      findAcceptedMemberUserIdsIncludingDescendants: vi
        .fn()
        .mockResolvedValue(memberIds(10)),
    };

    legalCheckRepository = {
      countRecentChecks: vi.fn().mockResolvedValue(0),
      sumDailyTokens: vi.fn().mockResolvedValue(0),
      logCheckAttempt: vi.fn().mockResolvedValue(undefined),
      upsert: vi.fn().mockImplementation((check) => Promise.resolve(check)),
    };

    systemSettingRepository = {
      get: vi.fn().mockResolvedValue(success(null)),
    };

    useCase = new AnalyzePollLegalityUseCase({
      clock: { now: () => Instant.parse('2026-01-01T12:00:00.000Z') },
      pollRepository: pollRepository as PollRepository,
      organizationRepository: organizationRepository as OrganizationRepository,
      legalCheckRepository: legalCheckRepository as LegalCheckRepository,
      systemSettingRepository:
        systemSettingRepository as SystemSettingRepository,
    });
  });

  const runValidate = () =>
    useCase.validate({
      pollId: 'poll-1',
      userId: 'user-1',
      model: 'deepseek',
      locale: 'en',
    });

  it.each([
    'legal_check_min_org_size',
    'legal_check_max_per_admin_per_hour',
    'legal_check_daily_token_cap',
  ])(
    'propagates failure reading %s before executing its quota query',
    async (failedKey) => {
      (
        systemSettingRepository.get as ReturnType<typeof vi.fn>
      ).mockImplementation(async (key: string) =>
        key === failedKey ? failure('common.errors.unexpected') : success(null)
      );

      expect(await runValidate()).toEqual(failure('common.errors.unexpected'));

      if (failedKey === 'legal_check_max_per_admin_per_hour') {
        expect(legalCheckRepository.countRecentChecks).not.toHaveBeenCalled();
      }

      if (failedKey === 'legal_check_daily_token_cap') {
        expect(legalCheckRepository.sumDailyTokens).not.toHaveBeenCalled();
      }
    }
  );
  it('rejects a setting returned for a different quota key', async () => {
    (systemSettingRepository.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      decodeStoredSetting('legal_check_daily_token_cap', '0')
    );

    expect(await runValidate()).toEqual(failure('common.errors.unexpected'));
  });
  it('fails if poll not found', async () => {
    (pollRepository.getPollById as ReturnType<typeof vi.fn>).mockResolvedValue(
      success(null)
    );

    const result = await runValidate();
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AIErrors.POLL_NOT_FOUND);
    }
  });

  it('fails if user is not admin of the org', async () => {
    (
      organizationRepository.isUserAdmin as ReturnType<typeof vi.fn>
    ).mockResolvedValue(false);

    const result = await runValidate();
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AIErrors.NOT_ADMIN);
    }
  });

  it('fails if poll is not ready (draft)', async () => {
    (pollRepository.getPollById as ReturnType<typeof vi.fn>).mockResolvedValue(
      success(createMockPoll({ isReady: false }))
    );

    const result = await runValidate();
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AIErrors.POLL_NOT_READY);
    }
  });

  it('fails if org tree has fewer members than min threshold', async () => {
    (
      systemSettingRepository.get as ReturnType<typeof vi.fn>
    ).mockImplementation(async (key: string) =>
      key === 'legal_check_min_org_size'
        ? decodeStoredSetting(key, '5')
        : success(null)
    );
    (
      organizationRepository.findAcceptedMemberUserIdsIncludingDescendants as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValue(memberIds(2));

    const result = await runValidate();
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AIErrors.ORG_TOO_SMALL);
    }
  });

  it('skips org-size check when setting is 0', async () => {
    (
      systemSettingRepository.get as ReturnType<typeof vi.fn>
    ).mockImplementation(async (key: string) =>
      key === 'legal_check_min_org_size'
        ? decodeStoredSetting(key, '0')
        : success(null)
    );
    (
      organizationRepository.findAcceptedMemberUserIdsIncludingDescendants as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValue(memberIds(1));

    const result = await runValidate();
    expect(result.success).toBe(true);
  });

  it('fails if hourly rate limit exceeded (default 10)', async () => {
    (
      legalCheckRepository.countRecentChecks as ReturnType<typeof vi.fn>
    ).mockResolvedValue(10);

    const result = await runValidate();
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AIErrors.RATE_LIMIT_EXCEEDED);
    }
  });

  it('respects custom hourly rate limit from system settings', async () => {
    (
      systemSettingRepository.get as ReturnType<typeof vi.fn>
    ).mockImplementation(async (key: string) =>
      key === 'legal_check_max_per_admin_per_hour'
        ? decodeStoredSetting(key, '5')
        : success(null)
    );
    (
      legalCheckRepository.countRecentChecks as ReturnType<typeof vi.fn>
    ).mockResolvedValue(5);

    const result = await runValidate();
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AIErrors.RATE_LIMIT_EXCEEDED);
    }
  });

  it('fails if daily token cap exceeded (default 100000)', async () => {
    (
      legalCheckRepository.sumDailyTokens as ReturnType<typeof vi.fn>
    ).mockResolvedValue(100_000);

    const result = await runValidate();
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AIErrors.TOKEN_CAP_EXCEEDED);
    }
  });

  it('skips token cap when setting is 0', async () => {
    (
      systemSettingRepository.get as ReturnType<typeof vi.fn>
    ).mockImplementation(async (key: string) =>
      key === 'legal_check_daily_token_cap'
        ? decodeStoredSetting(key, '0')
        : success(null)
    );
    (
      legalCheckRepository.sumDailyTokens as ReturnType<typeof vi.fn>
    ).mockResolvedValue(999_999);

    const result = await runValidate();
    expect(result.success).toBe(true);
  });

  it('passes validation with all defaults satisfied', async () => {
    const result = await runValidate();
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.poll).toBe(mockPoll);
      expect(result.value.userId).toBe('user-1');
      expect(result.value.model).toBe('deepseek');
      expect(result.value.locale).toBe('en');
    }
  });

  describe('superadmin bypass', () => {
    const runValidateAsSuperadmin = () =>
      useCase.validate({
        pollId: 'poll-1',
        userId: 'user-1',
        model: 'deepseek',
        locale: 'en',
        isSuperadmin: true,
      });

    it('bypasses NOT_ADMIN for superadmin', async () => {
      (
        organizationRepository.isUserAdmin as ReturnType<typeof vi.fn>
      ).mockResolvedValue(false);

      const result = await runValidateAsSuperadmin();
      expect(result.success).toBe(true);
    });

    it('bypasses ORG_TOO_SMALL for superadmin', async () => {
      (
        organizationRepository.findAcceptedMemberUserIdsIncludingDescendants as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue(memberIds(1));

      const result = await runValidateAsSuperadmin();
      expect(result.success).toBe(true);
    });

    it('still enforces POLL_NOT_READY for superadmin', async () => {
      (
        pollRepository.getPollById as ReturnType<typeof vi.fn>
      ).mockResolvedValue(success(createMockPoll({ isReady: false })));

      const result = await runValidateAsSuperadmin();
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(AIErrors.POLL_NOT_READY);
      }
    });

    it('bypasses RATE_LIMIT for superadmin', async () => {
      (
        legalCheckRepository.countRecentChecks as ReturnType<typeof vi.fn>
      ).mockResolvedValue(999);

      const result = await runValidateAsSuperadmin();
      expect(result.success).toBe(true);
    });

    it('bypasses TOKEN_CAP for superadmin', async () => {
      (
        legalCheckRepository.sumDailyTokens as ReturnType<typeof vi.fn>
      ).mockResolvedValue(999_999);

      const result = await runValidateAsSuperadmin();
      expect(result.success).toBe(true);
    });
  });
});
