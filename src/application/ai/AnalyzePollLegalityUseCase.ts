/** Authorizes an analysis request and evaluates typed, persisted quota settings.
 * Typed setting failures propagate before quota queries; one supplied instant anchors all counts. */
import { z } from 'zod';
import { PollId, UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { Language } from '@/domain/user/UserValues';
import { AIModelKey } from '@/domain/ai/LegalAnalysis';
import { Clock } from '@/application/shared/EntityCreation';
import { readSystemSetting } from '@/application/systemSetting/readSystemSetting';
import type { Result } from '@/domain/shared/Result';
import { success, failure } from '@/domain/shared/Result';
import type { PollRepository } from '@/domain/poll/PollRepository';
import type { OrganizationRepository } from '@/domain/organization/OrganizationRepository';
import type { LegalCheckRepository } from '@/domain/ai/LegalCheckRepository';
import type {
  SystemSettingRepository,
  SystemSettingReadError,
} from '@/domain/systemSetting/SystemSettingRepository';
import type { Poll } from '@/domain/poll/Poll';
import { AIError, AIErrors } from './AIErrors';

const ONE_HOUR_MS = 60 * 60 * 1000;

const SETTING_KEYS = {
  MAX_PER_HOUR: 'legal_check_max_per_admin_per_hour',
  DAILY_TOKEN_CAP: 'legal_check_daily_token_cap',
  MIN_ORG_SIZE: 'legal_check_min_org_size',
} as const;

export interface AnalyzePollLegalityInput {
  pollId: string;
  userId: string;
  model: string;
  locale: string;
  isSuperadmin?: boolean;
}

export interface ValidatedAnalysisInput {
  poll: Poll;
  model: AIModelKey;
  locale: Language;
  userId: UserId;
}

export interface AnalyzePollLegalityDependencies {
  clock: Clock;
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

  constructor(private readonly deps: AnalyzePollLegalityDependencies) {
    this.pollRepository = deps.pollRepository;
    this.organizationRepository = deps.organizationRepository;
    this.legalCheckRepository = deps.legalCheckRepository;
    this.systemSettingRepository = deps.systemSettingRepository;
  }

  async validate(
    input: AnalyzePollLegalityInput
  ): Promise<
    Result<
      ValidatedAnalysisInput,
      AIError | 'common.errors.validationFailed' | SystemSettingReadError
    >
  > {
    const parsed = z
      .object({
        pollId: PollId,
        userId: UserId,
        model: AIModelKey,
        locale: Language,
      })
      .safeParse(input);

    if (!parsed.success) {
      return failure('common.errors.validationFailed');
    }

    const command = { ...input, ...parsed.data };
    const now = Instant.toDate(this.deps.clock.now());
    const since = Instant.fromDate(new Date(now.getTime() - ONE_HOUR_MS));
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const pollResult = await this.pollRepository.getPollById(command.pollId);

    if (!pollResult.success || !pollResult.value) {
      return failure(AIErrors.POLL_NOT_FOUND);
    }

    const poll = pollResult.value;

    if (!command.isSuperadmin) {
      const isAdmin = await this.organizationRepository.isUserAdmin(
        command.userId,
        poll.organizationId
      );

      if (!isAdmin) {
        return failure(AIErrors.NOT_ADMIN);
      }
    }

    if (!poll.isReady()) {
      return failure(AIErrors.POLL_NOT_READY);
    }

    if (!command.isSuperadmin) {
      const minOrgSizeSetting = await readSystemSetting(
        this.systemSettingRepository,
        SETTING_KEYS.MIN_ORG_SIZE
      );

      if (!minOrgSizeSetting.success) {
        return minOrgSizeSetting;
      }

      const minOrgSize = minOrgSizeSetting.value.value;

      if (minOrgSize > 0) {
        const memberIds =
          await this.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
            poll.organizationId
          );

        if (memberIds.length < minOrgSize) {
          return failure(AIErrors.ORG_TOO_SMALL);
        }
      }
    }

    if (!command.isSuperadmin) {
      const maxPerHourSetting = await readSystemSetting(
        this.systemSettingRepository,
        SETTING_KEYS.MAX_PER_HOUR
      );

      if (!maxPerHourSetting.success) {
        return maxPerHourSetting;
      }

      const maxPerHour = maxPerHourSetting.value.value;
      const recentCount = await this.legalCheckRepository.countRecentChecks(
        command.userId,
        since
      );

      if (recentCount >= maxPerHour) {
        return failure(AIErrors.RATE_LIMIT_EXCEEDED);
      }

      const dailyTokenCapSetting = await readSystemSetting(
        this.systemSettingRepository,
        SETTING_KEYS.DAILY_TOKEN_CAP
      );

      if (!dailyTokenCapSetting.success) {
        return dailyTokenCapSetting;
      }

      const dailyTokenCap = dailyTokenCapSetting.value.value;

      if (dailyTokenCap > 0) {
        const dailyTokens = await this.legalCheckRepository.sumDailyTokens(
          command.userId,
          Instant.fromDate(dayStart)
        );

        if (dailyTokens >= dailyTokenCap) {
          return failure(AIErrors.TOKEN_CAP_EXCEEDED);
        }
      }
    }

    return success({
      poll,
      model: command.model,
      locale: command.locale,
      userId: command.userId,
    });
  }
}
