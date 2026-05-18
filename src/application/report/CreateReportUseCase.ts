import { Result, success, failure } from '../../domain/shared/Result';
import { Report } from '../../domain/report/Report';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ReportVisibility } from '../../domain/report/ReportVisibility';
import { ReportDomainCodes } from '../../domain/report/ReportDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { ReportErrors } from './ReportErrors';
import { stripMarkdownToPlainText } from './StripMarkdownToPlainText';

export interface OrgRepoForCreateReport {
  isUserExactMember(userId: string, orgId: string): Promise<boolean>;
}

export interface BoardRepoForCreateReport {
  findByOrganizationId(orgId: string): Promise<Array<{ id: string }>>;
}

export interface CreateReportInput {
  userId: string;
  organizationId: string;
  title: string;
  body: string;
  visibility: ReportVisibility;
  boardIds: string[];
}

export class CreateReportUseCase {
  constructor(
    private reports: ReportRepository,
    private orgs: OrgRepoForCreateReport,
    private boards: BoardRepoForCreateReport,
    private profanityChecker?: ProfanityChecker
  ) {}

  async execute(input: CreateReportInput): Promise<Result<Report, string>> {
    const isMember = await this.orgs.isUserExactMember(
      input.userId,
      input.organizationId
    );

    if (!isMember) {
      return failure(ReportErrors.NOT_ORG_MEMBER);
    }

    if (input.visibility === ReportVisibility.WITHIN_BOARDS) {
      const orgBoards = await this.boards.findByOrganizationId(
        input.organizationId
      );
      const orgBoardIds = new Set(orgBoards.map((b) => b.id));

      for (const b of input.boardIds) {
        if (!orgBoardIds.has(b)) {
          return failure(ReportDomainCodes.REPORT_BOARD_NOT_IN_ORG);
        }
      }
    }

    const domainResult = Report.create({
      title: input.title,
      body: input.body,
      organizationId: input.organizationId,
      createdById: input.userId,
      visibility: input.visibility,
      boardIds: input.boardIds,
      profanityChecker: this.profanityChecker,
      stripMarkdownToPlainText,
    });

    if (!domainResult.success) {
      return failure(domainResult.error);
    }

    return await this.reports.create(domainResult.value);
  }
}
