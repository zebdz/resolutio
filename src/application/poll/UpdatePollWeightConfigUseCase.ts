import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PollEligibleMemberRepository } from '../../domain/poll/PollEligibleMemberRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import {
  isOwnershipMode,
  parseDistributionType,
} from '../../domain/poll/DistributionType';
import { parsePropertyAggregation } from '../../domain/poll/PropertyAggregation';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';
import { PollErrors } from './PollErrors';
import { PollWeightCalculator } from './PollWeightCalculator';

export interface UpdatePollWeightConfigInput {
  pollId: string;
  newConfig: {
    distributionType?: string;
    propertyAggregation?: string;
    propertyIds?: string[];
  };
  adminUserId: string;
}

export class UpdatePollWeightConfigUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private userRepository: UserRepository,
    private organizationRepository: OrganizationRepository,
    private eligibleRepository: PollEligibleMemberRepository,
    private propertyAssetRepository: PropertyAssetRepository,
    private organizationPropertyRepository: OrganizationPropertyRepository,
    private pollWeightCalculator: PollWeightCalculator
  ) {}

  async execute(
    input: UpdatePollWeightConfigInput
  ): Promise<Result<void, string>> {
    const pollR = await this.pollRepository.getPollById(input.pollId);

    if (!pollR.success) {
      return failure(pollR.error);
    }

    const poll = pollR.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // Auth
    const isSuper = await this.userRepository.isSuperAdmin(input.adminUserId);

    if (!isSuper) {
      const isAdmin = await this.organizationRepository.isUserAdmin(
        input.adminUserId,
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

    // Once a poll is ACTIVE, voters can see the participant list — switching
    // the distribution mode here would silently re-snapshot all weights mid-
    // flight. Lock weight-config edits to DRAFT/READY (matches the per-row
    // "Edit Weight" gate in the UI, which only opens in READY).
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

    // Validate property ids belong to the org tree (direct org + descendants).
    // Cross-tree scope is legitimate: a parent org's poll can reference properties
    // owned through descendant orgs.
    if (propIds.length > 0) {
      const treePropsR =
        await this.organizationPropertyRepository.findByOrganizationTree(
          poll.organizationId
        );

      if (!treePropsR.success) {
        return failure(treePropsR.error);
      }

      const validIds = new Set(
        treePropsR.value.flatMap((g) => g.properties.map((p) => p.id))
      );

      for (const id of propIds) {
        if (!validIds.has(id)) {
          return failure(PollDomainCodes.PROPERTY_NOT_IN_ORG);
        }
      }
    }

    // Load eligible ceiling + current participants
    const elR = await this.eligibleRepository.findByPollId(poll.id);

    if (!elR.success) {
      return failure(elR.error);
    }

    const candidates = elR.value.map((m) => m.userId);

    const currentR = await this.participantRepository.getParticipants(poll.id);

    if (!currentR.success) {
      return failure(currentR.error);
    }

    const currentByUser = new Map(
      currentR.value.map((p) => [p.userId, p] as const)
    );

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

    const add: Array<{ userId: string; weight: number }> = [];
    const remove: Array<{
      participantId: string;
      userId: string;
      oldWeight: number;
    }> = [];
    const update: Array<{
      participantId: string;
      userId: string;
      oldWeight: number;
      newWeight: number;
    }> = [];

    for (const userId of candidates) {
      const w = newWeights.get(userId);
      const cur = currentByUser.get(userId);

      if (w === undefined && cur) {
        remove.push({
          participantId: cur.id,
          userId,
          oldWeight: cur.userWeight,
        });
      } else if (w !== undefined && !cur) {
        add.push({ userId, weight: w });
      } else if (w !== undefined && cur && cur.userWeight !== w) {
        update.push({
          participantId: cur.id,
          userId,
          oldWeight: cur.userWeight,
          newWeight: w,
        });
      }
    }

    const reason = this.buildReason(
      poll.distributionType,
      dtR.value,
      poll.propertyAggregation,
      paR.value,
      poll.propertyIds,
      propIds
    );

    const applyR = await this.participantRepository.applyWeightConfigChange(
      poll.id,
      dtR.value,
      paR.value,
      propIds,
      add,
      remove,
      update,
      input.adminUserId,
      reason
    );

    if (!applyR.success) {
      return failure(applyR.error);
    }

    return success(undefined);
  }

  private buildReason(
    oldDT: string,
    newDT: string,
    oldPA: string,
    newPA: string,
    oldIds: string[],
    newIds: string[]
  ): string {
    const dtChanged = oldDT !== newDT;
    const paChanged = oldPA !== newPA;
    const scopeChanged =
      oldIds.length !== newIds.length ||
      !oldIds.every((id) => newIds.includes(id));

    const changeCount = [dtChanged, paChanged, scopeChanged].filter(
      Boolean
    ).length;

    if (changeCount > 1) {
      return 'Weight config changed';
    }

    if (dtChanged) {
      return `Distribution type changed to ${newDT}`;
    }

    if (paChanged) {
      return `Property aggregation changed to ${newPA}`;
    }

    if (scopeChanged) {
      return 'Property scope changed';
    }

    return 'Weight config reconfirmed';
  }
}
