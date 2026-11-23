/** Decodes a creation request, checks membership and supplies identity/time.
 * Poll validation stays in the aggregate; persistence retains the assigned identity. */
import { z } from 'zod';
import {
  BoardId,
  OrganizationId,
  PollId,
  UserId,
} from '../../domain/shared/EntityIds';
import { Clock, IdGenerator, entityCreation } from '../shared/EntityCreation';
import { Result, success, failure } from '../../domain/shared/Result';
import { parsePollWeightConfig } from '../../domain/poll/PollWeightConfig';
import { Poll } from '../../domain/poll/Poll';
import { parseNewPollContent } from '../../domain/poll/PollContent';
import { PollPeriod } from '../../domain/poll/PollPeriod';
import { PollType, parsePollType } from '../../domain/poll/PollType';
import { PollRepository } from '../../domain/poll/PollRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { PollErrors, PollUseCaseFailure } from './PollErrors';

export interface CreatePollInput {
  title: string;
  description: string;
  organizationId: string;
  boardId: string | null;
  createdBy: string;
  startDate: Date;
  endDate: Date;
  distributionType?: string;
  propertyAggregation?: string;
  propertyIds?: string[];
  pollType?: string;
  anonymous?: boolean;
}

export class CreatePollUseCase {
  constructor(
    private pollRepository: PollRepository,
    private boardRepository: BoardRepository,
    private organizationRepository: OrganizationRepository,
    private ids: IdGenerator,
    private clock: Clock,
    private profanityChecker?: ProfanityChecker
  ) {}

  async execute(
    input: CreatePollInput
  ): Promise<Result<Poll, PollUseCaseFailure>> {
    const decoded = z
      .object({
        organizationId: OrganizationId,
        boardId: BoardId.nullable(),
        createdBy: UserId,
      })
      .safeParse(input);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const command = { ...input, ...decoded.data };

    // 1. If boardId provided, validate board exists and check board membership
    if (command.boardId) {
      const board = await this.boardRepository.findById(command.boardId);

      if (!board) {
        return failure(PollErrors.BOARD_NOT_FOUND);
      }

      const isMember = await this.boardRepository.isUserMember(
        command.createdBy,
        command.boardId
      );

      if (!isMember) {
        return failure(PollErrors.NOT_BOARD_MEMBER);
      }
    } else {
      // Org-wide poll: check org membership
      const isMember = await this.organizationRepository.isUserMember(
        command.createdBy,
        command.organizationId
      );

      if (!isMember) {
        return failure(PollErrors.NOT_ORG_MEMBER);
      }
    }

    // 2. Create poll domain object with validation
    const content = parseNewPollContent(command.title, command.description);

    if (!content.success) {
      return content;
    }

    const period = PollPeriod.create(command.startDate, command.endDate);

    if (!period.success) {
      return period;
    }

    const kind = parsePollType(
      command.pollType === undefined ? PollType.ORGANIZATION : command.pollType
    );

    if (!kind.success) {
      return kind;
    }

    const pollResult = Poll.create(
      content.value.title,
      content.value.description,
      command.organizationId,
      command.boardId,
      command.createdBy,
      period.value,
      entityCreation(PollId, this.ids, this.clock),
      this.profanityChecker,
      kind.value,
      command.anonymous ?? false
    );

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    // Apply optional weight config overrides (defaults are EQUAL / RAW_SUM / [])
    if (
      command.distributionType !== undefined ||
      command.propertyAggregation !== undefined ||
      command.propertyIds !== undefined
    ) {
      const config = parsePollWeightConfig(pollResult.value.pollType, {
        distributionType:
          command.distributionType ?? pollResult.value.distributionType,
        propertyAggregation:
          command.propertyAggregation ?? pollResult.value.propertyAggregation,
        propertyIds: command.propertyIds ?? pollResult.value.propertyIds,
      });

      if (!config.success) {
        return config;
      }

      const configResult = pollResult.value.applyWeightConfig(
        config.value.distributionType,
        config.value.propertyAggregation,
        config.value.propertyIds
      );

      if (!configResult.success) {
        return failure(configResult.error);
      }
    }

    // 3. Persist the validated domain object
    const result = await this.pollRepository.createPoll(pollResult.value);

    return result;
  }
}
