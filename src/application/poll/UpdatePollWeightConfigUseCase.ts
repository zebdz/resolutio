/** Poll application boundary validates requests, invokes domain behavior and
 * preserves known failure codes across authorization and persistence ports. */
import { VotingWeight } from '../../domain/poll/VotingWeight';
import { z } from 'zod';
import {
  PollId,
  UserId,
  PropertyId,
  ParticipantId,
  ParticipantWeightHistoryId,
} from '../../domain/shared/EntityIds';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { Clock, IdGenerator } from '../shared/EntityCreation';
import {
  ParticipantRepository,
  ParticipantAddition,
  ParticipantRemoval,
  ParticipantReweighting,
} from '../../domain/poll/ParticipantRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PollEligibleMemberRepository } from '../../domain/poll/PollEligibleMemberRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
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
import { PollErrors, PollUseCaseFailure } from './PollErrors';
import {
  PollWeightCalculator,
  PollWeightCalculationFailure,
} from './PollWeightCalculator';

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
    private pollWeightCalculator: PollWeightCalculator,
    private ids: IdGenerator,
    private clock: Clock
  ) {}

  async execute(
    rawRequest: UpdatePollWeightConfigInput
  ): Promise<Result<void, PollUseCaseFailure | PollWeightCalculationFailure>> {
    const decoded = z
      .object({ pollId: PollId, adminUserId: UserId })
      .safeParse(rawRequest);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const input = { ...rawRequest, ...decoded.data };

    const pollR = await this.pollRepository.getPollById(input.pollId);

    if (!pollR.success) {
      return failure(pollR.error);
    }

    const poll = pollR.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // The weight configuration of an open poll is fixed: EQUAL / RAW_SUM /
    // no property scope. One person, one vote.
    if (poll.isOpen()) {
      return failure(PollErrors.OPEN_CONFIG_FIXED);
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
    const decodedProperties = z
      .array(PropertyId)
      .safeParse(input.newConfig.propertyIds ?? poll.propertyIds);

    if (!decodedProperties.success) {
      return failure(PollDomainCodes.PROPERTY_NOT_IN_ORG);
    }

    const propIds = decodedProperties.data;

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

    const add: ParticipantAddition[] = [];
    const remove: ParticipantRemoval[] = [];
    const update: ParticipantReweighting[] = [];
    const at = this.clock.now();
    const historyCreation = () => ({
      id: this.ids.generate(ParticipantWeightHistoryId),
      now: at,
    });

    for (const userId of candidates) {
      const w = newWeights.get(userId);
      const cur = currentByUser.get(userId);

      if (w === undefined && cur) {
        remove.push({
          participantId: cur.id,
          userId,
          oldWeight: cur.userWeight,
          historyCreation: historyCreation(),
        });
      } else if (w !== undefined && !cur) {
        add.push({
          userId,
          weight: w,
          creation: { id: this.ids.generate(ParticipantId), now: at },
          historyCreation: historyCreation(),
        });
      } else if (w !== undefined && cur && cur.userWeight !== w) {
        update.push({
          participantId: cur.id,
          userId,
          oldWeight: cur.userWeight,
          newWeight: w,
          historyCreation: historyCreation(),
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
      reason,
      poll.revision
    );

    if (!applyR.success) {
      return failure(applyR.error);
    }

    return success(undefined);
  }

  private buildReason(
    oldDT: DistributionType,
    newDT: DistributionType,
    oldPA: PropertyAggregation,
    newPA: PropertyAggregation,
    oldIds: PropertyId[],
    newIds: PropertyId[]
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
