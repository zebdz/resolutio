import { Result, failure } from '../../domain/shared/Result';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { ReportErrors } from './ReportErrors';
import { stripMarkdownToPlainText } from './StripMarkdownToPlainText';

export interface OrgRepoForUpdate {
  isUserAdmin(userId: string, orgId: string): Promise<boolean>;
}

export interface UserRepoForUpdate {
  isSuperAdmin(userId: string): Promise<boolean>;
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
    private profanityChecker?: ProfanityChecker
  ) {}

  async execute(input: UpdateReportInput): Promise<Result<void, string>> {
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

    const titleResult = report.updateTitle(input.title, this.profanityChecker);

    if (!titleResult.success) {
      return failure(titleResult.error);
    }

    const bodyResult = report.updateBody(
      input.body,
      this.profanityChecker,
      stripMarkdownToPlainText
    );

    if (!bodyResult.success) {
      return failure(bodyResult.error);
    }

    return this.reports.update(report);
  }
}
