/** Authorizes report creation and decodes content using the domain's validation policy.
 * Typed values and explicit identity/time reach the aggregate before persistence. */
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
import { Result, success, failure } from '../../domain/shared/Result';
import {
  Report,
  parseReportTitle,
  parseReportBody,
} from '../../domain/report/Report';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ReportVisibility } from '../../domain/report/ReportVisibility';
import { ReportDomainCodes } from '../../domain/report/ReportDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { ReportErrors } from './ReportErrors';
import { stripMarkdownToPlainText } from '../shared/StripMarkdownToPlainText';

export interface OrgRepoForCreateReport {
  isUserExactMember(userId: UserId, orgId: OrganizationId): Promise<boolean>;
}

export interface BoardRepoForCreateReport {
  findByOrganizationId(orgId: OrganizationId): Promise<Array<{ id: BoardId }>>;
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
    private ids: IdGenerator,
    private clock: Clock,
    private profanityChecker?: ProfanityChecker
  ) {}

  async execute(
    input: CreateReportInput
  ): Promise<Result<Report, ReportUseCaseFailure>> {
    const decoded = z
      .object({
        userId: UserId,
        organizationId: OrganizationId,
        boardIds: z.array(BoardId),
      })
      .safeParse(input);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const command = { ...input, ...decoded.data };
    const isMember = await this.orgs.isUserExactMember(
      command.userId,
      command.organizationId
    );

    if (!isMember) {
      return failure(ReportErrors.NOT_ORG_MEMBER);
    }

    if (command.visibility === ReportVisibility.WITHIN_BOARDS) {
      const orgBoards = await this.boards.findByOrganizationId(
        command.organizationId
      );
      const orgBoardIds = new Set(orgBoards.map((b) => b.id));

      for (const b of command.boardIds) {
        if (!orgBoardIds.has(b)) {
          return failure(ReportDomainCodes.REPORT_BOARD_NOT_IN_ORG);
        }
      }
    }

    const visibility = z.enum(ReportVisibility).safeParse(command.visibility);

    if (!visibility.success) {
      return failure(ReportDomainCodes.REPORT_INVALID_VISIBILITY);
    }

    const title = parseReportTitle(command.title, this.profanityChecker);

    if (!title.success) {
      return title;
    }

    const body = parseReportBody(
      command.body,
      this.profanityChecker,
      stripMarkdownToPlainText
    );

    if (!body.success) {
      return body;
    }

    const domainResult = Report.create(
      {
        title: title.value,
        body: body.value,
        organizationId: command.organizationId,
        createdById: command.userId,
        visibility: visibility.data,
        boardIds: command.boardIds,
        profanityChecker: this.profanityChecker,
        stripMarkdownToPlainText,
      },
      entityCreation(ReportId, this.ids, this.clock)
    );

    if (!domainResult.success) {
      return failure(domainResult.error);
    }

    return await this.reports.create(domainResult.value);
  }
}
