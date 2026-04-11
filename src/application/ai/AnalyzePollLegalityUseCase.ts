import type { Result } from '@/domain/shared/Result';
import { success, failure } from '@/domain/shared/Result';
import type { PollRepository } from '@/domain/poll/PollRepository';
import type { OrganizationRepository } from '@/domain/organization/OrganizationRepository';
import type { LegalCheckRepository } from '@/domain/ai/LegalCheckRepository';
import type { SystemSettingRepository } from '@/domain/systemSetting/SystemSettingRepository';
import type { Poll } from '@/domain/poll/Poll';
import { AIErrors } from './AIErrors';

const ONE_HOUR_MS = 60 * 60 * 1000;

const SETTING_KEYS = {
  MAX_PER_HOUR: 'legal_check_max_per_admin_per_hour',
  DAILY_TOKEN_CAP: 'legal_check_daily_token_cap',
  MIN_ORG_SIZE: 'legal_check_min_org_size',
} as const;

const DEFAULTS = {
  MAX_PER_HOUR: 10,
  DAILY_TOKEN_CAP: 100_000,
  MIN_ORG_SIZE: 3,
} as const;

export interface AnalyzePollLegalityInput {
  pollId: string;
  userId: string;
  model: string;
  locale: string;
}

export interface ValidatedAnalysisInput {
  poll: Poll;
  model: string;
  locale: string;
  userId: string;
}

export interface AnalyzePollLegalityDependencies {
  pollRepository: PollRepository;
  organizationRepository: OrganizationRepository;
  legalCheckRepository: LegalCheckRepository;
  systemSettingRepository: SystemSettingRepository;
}

export class AnalyzePollLegalityUseCase {
  private pollRepository: PollRepository;
  private organizationRepository: OrganizationRepository;
  private legalCheckRepository: LegalCheckRepository;
  private systemSettingRepository: SystemSettingRepository;

  constructor(deps: AnalyzePollLegalityDependencies) {
    this.pollRepository = deps.pollRepository;
    this.organizationRepository = deps.organizationRepository;
    this.legalCheckRepository = deps.legalCheckRepository;
    this.systemSettingRepository = deps.systemSettingRepository;
  }

  async validate(
    input: AnalyzePollLegalityInput
  ): Promise<Result<ValidatedAnalysisInput, string>> {
    const pollResult = await this.pollRepository.getPollById(input.pollId);

    if (!pollResult.success || !pollResult.value) {
      return failure(AIErrors.POLL_NOT_FOUND);
    }

    const poll = pollResult.value;

    const isAdmin = await this.organizationRepository.isUserAdmin(
      input.userId,
      poll.organizationId
    );

    if (!isAdmin) {
      return failure(AIErrors.NOT_ADMIN);
    }

    if (!poll.isReady()) {
      return failure(AIErrors.POLL_NOT_READY);
    }

    const minOrgSize = await this.getNumericSetting(
      SETTING_KEYS.MIN_ORG_SIZE,
      DEFAULTS.MIN_ORG_SIZE
    );

    if (minOrgSize > 0) {
      const memberIds =
        await this.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
          poll.organizationId
        );

      if (memberIds.length < minOrgSize) {
        return failure(AIErrors.ORG_TOO_SMALL);
      }
    }

    const maxPerHour = await this.getNumericSetting(
      SETTING_KEYS.MAX_PER_HOUR,
      DEFAULTS.MAX_PER_HOUR
    );
    const recentCount = await this.legalCheckRepository.countRecentChecks(
      input.userId,
      ONE_HOUR_MS
    );

    if (recentCount >= maxPerHour) {
      return failure(AIErrors.RATE_LIMIT_EXCEEDED);
    }

    const dailyTokenCap = await this.getNumericSetting(
      SETTING_KEYS.DAILY_TOKEN_CAP,
      DEFAULTS.DAILY_TOKEN_CAP
    );

    if (dailyTokenCap > 0) {
      const dailyTokens = await this.legalCheckRepository.sumDailyTokens(
        input.userId
      );

      if (dailyTokens >= dailyTokenCap) {
        return failure(AIErrors.TOKEN_CAP_EXCEEDED);
      }
    }

    return success({
      poll,
      model: input.model,
      locale: input.locale,
      userId: input.userId,
    });
  }

  private async getNumericSetting(
    key: string,
    defaultValue: number
  ): Promise<number> {
    const raw = await this.systemSettingRepository.get(key);

    if (raw === null) {
      return defaultValue;
    }

    const parsed = parseInt(raw, 10);

    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
}
