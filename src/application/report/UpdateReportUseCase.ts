/** Authorizes report edits, preserves lifecycle precedence and decodes typed content.
 * The aggregate enforces profanity/attachment policies and explicit mutation time. */
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
import { parseReportTitle, parseReportBody } from '../../domain/report/Report';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { ReportErrors } from './ReportErrors';
import { stripMarkdownToPlainText } from '../shared/StripMarkdownToPlainText';

export interface OrgRepoForUpdate {
  isUserAdmin(userId: UserId, orgId: OrganizationId): Promise<boolean>;
}

export interface UserRepoForUpdate {
  isSuperAdmin(userId: UserId): Promise<boolean>;
}

export interface UpdateReportInput {
  reportId: string;
  callerId: string;
  title: string;
  body: string;
}

export class UpdateReportUseCase {
  constructor(
    private reports: ReportRepository,
    private orgs: OrgRepoForUpdate,
    private users: UserRepoForUpdate,
    private clock: Clock,
    private profanityChecker?: ProfanityChecker
  ) {}

  async execute(
    input: UpdateReportInput
  ): Promise<Result<void, ReportUseCaseFailure>> {
    const decoded = z
      .object({ reportId: ReportId, callerId: UserId })
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

    const editable = report.canEditContent();

    if (!editable.success) {
      return editable;
    }

    const title = parseReportTitle(command.title, this.profanityChecker);

    if (!title.success) {
      return title;
    }

    const titleResult = report.updateTitle(
      title.value,
      this.clock.now(),
      this.profanityChecker
    );

    if (!titleResult.success) {
      return failure(titleResult.error);
    }

    const body = parseReportBody(
      command.body,
      this.profanityChecker,
      stripMarkdownToPlainText
    );

    if (!body.success) {
      return body;
    }

    const bodyResult = report.updateBody(
      body.value,
      this.clock.now(),
      this.profanityChecker,
      stripMarkdownToPlainText
    );

    if (!bodyResult.success) {
      return failure(bodyResult.error);
    }

    return this.reports.update(report);
  }
}
