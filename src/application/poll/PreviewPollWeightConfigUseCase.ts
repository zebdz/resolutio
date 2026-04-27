import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PollEligibleMemberRepository } from '../../domain/poll/PollEligibleMemberRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import {
  DistributionType,
  isOwnershipMode,
  parseDistributionType,
} from '../../domain/poll/DistributionType';
import {
  PropertyAggregation,
  parsePropertyAggregation,
} from '../../domain/poll/PropertyAggregation';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';
import { PollErrors } from './PollErrors';
import { PollWeightCalculator } from './PollWeightCalculator';

export interface PreviewPollWeightConfigInput {
  pollId: string;
  newConfig: {
    distributionType?: string;
    propertyAggregation?: string;
    propertyIds?: string[];
  };
  actingUserId: string;
}

export interface PreviewPollWeightConfigOutput {
  effectiveConfig: {
    distributionType: DistributionType;
    propertyAggregation: PropertyAggregation;
    propertyIds: string[];
  };
  addedParticipants: Array<{ userId: string; newWeight: number }>;
  removedParticipants: Array<{ userId: string }>;
  reweightedParticipants: Array<{
    userId: string;
    oldWeight: number;
    newWeight: number;
  }>;
  totalWeight: number;
}

export class PreviewPollWeightConfigUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private userRepository: UserRepository,
    private organizationRepository: OrganizationRepository,
    private eligibleRepository: PollEligibleMemberRepository,
    private propertyAssetRepository: PropertyAssetRepository,
    private pollWeightCalculator: PollWeightCalculator
  ) {}

  async execute(
    input: PreviewPollWeightConfigInput
  ): Promise<Result<PreviewPollWeightConfigOutput, string>> {
    const pollR = await this.pollRepository.getPollById(input.pollId);

    if (!pollR.success) {
      return failure(pollR.error);
    }

    const poll = pollR.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // Auth
    const isSuper = await this.userRepository.isSuperAdmin(input.actingUserId);

    if (!isSuper) {
      const isAdmin = await this.organizationRepository.isUserAdmin(
        input.actingUserId,
        poll.organizationId
      );

      if (!isAdmin) {
        return failure(PollErrors.NOT_AUTHORIZED);
      }
    }

    // Votes-cast guard
    const hasVotesR = await this.participantRepository.pollHasVotes(poll.id);

    if (!hasVotesR.success) {
      return failure(hasVotesR.error);
    }

    if (hasVotesR.value) {
      return failure(PollDomainCodes.VOTES_CAST_CANNOT_CHANGE_WEIGHT_CONFIG);
    }

    // Same lock semantics as UpdatePollWeightConfigUseCase: previewing a
    // mutation that the update path would refuse just confuses the user.
    if (poll.isActive() || poll.isFinished()) {
      return failure(PollDomainCodes.WEIGHT_CONFIG_LOCKED_AFTER_ACTIVATION);
    }

    // Merge + validate config
    const dtStr = input.newConfig.distributionType ?? poll.distributionType;
    const paStr =
      input.newConfig.propertyAggregation ?? poll.propertyAggregation;
    const propIds = input.newConfig.propertyIds ?? poll.propertyIds;

    const dtR = parseDistributionType(dtStr);

    if (!dtR.success) {
      return failure(dtR.error);
    }

    const paR = parsePropertyAggregation(paStr);

    if (!paR.success) {
      return failure(paR.error);
    }

    if (isOwnershipMode(dtR.value)) {
      const hasData = await this.propertyAssetRepository.orgHasOwnershipData(
        poll.organizationId
      );

      if (!hasData.success) {
        return failure(hasData.error);
      }

      if (!hasData.value) {
        return failure(PollDomainCodes.OWNERSHIP_DATA_MISSING);
      }
    }

    // Load eligible ceiling
    const elR = await this.eligibleRepository.findByPollId(poll.id);

    if (!elR.success) {
      return failure(elR.error);
    }

    const candidates = elR.value.map((m) => m.userId);

    const weightR = await this.pollWeightCalculator.compute({
      organizationId: poll.organizationId,
      distributionType: dtR.value,
      propertyAggregation: paR.value,
      propertyIds: propIds,
      candidates,
    });

    if (!weightR.success) {
      return failure(weightR.error);
    }

    const newWeights = weightR.value;

    // Current participants
    const currentR = await this.participantRepository.getParticipants(poll.id);

    if (!currentR.success) {
      return failure(currentR.error);
    }

    const currentByUser = new Map(
      currentR.value.map((p) => [p.userId, p] as const)
    );

    const added: Array<{ userId: string; newWeight: number }> = [];
    const removed: Array<{ userId: string }> = [];
    const reweighted: Array<{
      userId: string;
      oldWeight: number;
      newWeight: number;
    }> = [];

    for (const userId of candidates) {
      const newW = newWeights.get(userId);
      const cur = currentByUser.get(userId);

      if (newW === undefined && cur) {
        removed.push({ userId });
      } else if (newW !== undefined && !cur) {
        added.push({ userId, newWeight: newW });
      } else if (newW !== undefined && cur && cur.userWeight !== newW) {
        reweighted.push({
          userId,
          oldWeight: cur.userWeight,
          newWeight: newW,
        });
      }
    }

    const totalWeight = [...newWeights.values()].reduce((s, v) => s + v, 0);

    return success({
      effectiveConfig: {
        distributionType: dtR.value,
        propertyAggregation: paR.value,
        propertyIds: propIds,
      },
      addedParticipants: added,
      removedParticipants: removed,
      reweightedParticipants: reweighted,
      totalWeight,
    });
  }
}
