/** Decodes external report commands before authorization and domain behavior.
 * Identity/time dependencies keep persistence and lifecycle changes deterministic. */
import { ReportUseCaseFailure } from './ReportErrors';
import { z } from 'zod';
import {
  ReportId,
  OrganizationId,
  UserId,
  BoardId,
  PollId,
  ReportAttachmentId,
} from '../../domain/shared/EntityIds';
import { Clock, IdGenerator, entityCreation } from '../shared/EntityCreation';
import { Result, failure } from '../../domain/shared/Result';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ReportVisibility } from '../../domain/report/ReportVisibility';
import { ReportDomainCodes } from '../../domain/report/ReportDomainCodes';
import { ReportErrors } from './ReportErrors';

export interface OrgRepoForSetVisibility {
  isUserAdmin(userId: UserId, orgId: OrganizationId): Promise<boolean>;
}

export interface UserRepoForSetVisibility {
  isSuperAdmin(userId: UserId): Promise<boolean>;
}

export interface BoardRepoForSetVisibility {
  findByOrganizationId(orgId: OrganizationId): Promise<Array<{ id: BoardId }>>;
}

export interface SetReportVisibilityInput {
  reportId: string;
  callerId: string;
  visibility: ReportVisibility;
  boardIds: string[];
}

export class SetReportVisibilityUseCase {
  constructor(
    private reports: ReportRepository,
    private orgs: OrgRepoForSetVisibility,
    private users: UserRepoForSetVisibility,
    private boards: BoardRepoForSetVisibility,
    private clock: Clock
  ) {}

  async execute(
    input: SetReportVisibilityInput
  ): Promise<Result<void, ReportUseCaseFailure>> {
    const decoded = z
      .object({
        reportId: ReportId,
        callerId: UserId,
        boardIds: z.array(BoardId),
      })
      .safeParse(input);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const command = { ...input, ...decoded.data };
    const lookup = await this.reports.findByIdWithRelations(command.reportId);

    if (!lookup.success) {
      return failure(lookup.error);
    }

    if (!lookup.value) {
      return failure(ReportErrors.REPORT_NOT_FOUND);
    }

    const report = lookup.value;

    const isAuthor = report.createdById === command.callerId;
    const isAdmin =
      !isAuthor &&
      (await this.orgs.isUserAdmin(command.callerId, report.organizationId));
    const isSuper =
      !isAuthor &&
      !isAdmin &&
      (await this.users.isSuperAdmin(command.callerId));

    if (!isAuthor && !isAdmin && !isSuper) {
      return failure(ReportErrors.NOT_AUTHOR_OR_ADMIN);
    }

    if (command.visibility === ReportVisibility.WITHIN_BOARDS) {
      const orgBoards = await this.boards.findByOrganizationId(
        report.organizationId
      );
      const orgBoardIds = new Set(orgBoards.map((b) => b.id));

      for (const boardId of command.boardIds) {
        if (!orgBoardIds.has(boardId)) {
          return failure(ReportDomainCodes.REPORT_BOARD_NOT_IN_ORG);
        }
      }
    }

    const domainResult = report.setVisibility(
      command.visibility,
      command.boardIds,
      this.clock.now()
    );

    if (!domainResult.success) {
      return failure(domainResult.error);
    }

    return this.reports.update(report);
  }
}
