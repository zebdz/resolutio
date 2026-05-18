import { Result, failure } from '../../domain/shared/Result';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ReportVisibility } from '../../domain/report/ReportVisibility';
import { ReportDomainCodes } from '../../domain/report/ReportDomainCodes';
import { ReportErrors } from './ReportErrors';

export interface OrgRepoForSetVisibility {
  isUserAdmin(userId: string, orgId: string): Promise<boolean>;
}

export interface UserRepoForSetVisibility {
  isSuperAdmin(userId: string): Promise<boolean>;
}

export interface BoardRepoForSetVisibility {
  findByOrganizationId(orgId: string): Promise<Array<{ id: string }>>;
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
    private boards: BoardRepoForSetVisibility
  ) {}

  async execute(
    input: SetReportVisibilityInput
  ): Promise<Result<void, string>> {
    const lookup = await this.reports.findByIdWithRelations(input.reportId);

    if (!lookup.success) {
      return failure(lookup.error);
    }

    if (!lookup.value) {
      return failure(ReportErrors.REPORT_NOT_FOUND);
    }

    const report = lookup.value;

    const isAuthor = report.createdById === input.callerId;
    const isAdmin =
      !isAuthor &&
      (await this.orgs.isUserAdmin(input.callerId, report.organizationId));
    const isSuper =
      !isAuthor && !isAdmin && (await this.users.isSuperAdmin(input.callerId));

    if (!isAuthor && !isAdmin && !isSuper) {
      return failure(ReportErrors.NOT_AUTHOR_OR_ADMIN);
    }

    if (input.visibility === ReportVisibility.WITHIN_BOARDS) {
      const orgBoards = await this.boards.findByOrganizationId(
        report.organizationId
      );
      const orgBoardIds = new Set(orgBoards.map((b) => b.id));

      for (const boardId of input.boardIds) {
        if (!orgBoardIds.has(boardId)) {
          return failure(ReportDomainCodes.REPORT_BOARD_NOT_IN_ORG);
        }
      }
    }

    const domainResult = report.setVisibility(input.visibility, input.boardIds);

    if (!domainResult.success) {
      return failure(domainResult.error);
    }

    return this.reports.update(report);
  }
}
