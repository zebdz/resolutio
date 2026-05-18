import { Result, failure } from '../../domain/shared/Result';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ReportErrors } from './ReportErrors';

export interface OrgRepoForDowngradeReport {
  isUserAdmin(userId: string, orgId: string): Promise<boolean>;
}

export interface UserRepoForDowngradeReport {
  isSuperAdmin(userId: string): Promise<boolean>;
}

export interface DowngradeReportToDraftInput {
  reportId: string;
  callerId: string;
}

export class DowngradeReportToDraftUseCase {
  constructor(
    private reports: ReportRepository,
    private orgs: OrgRepoForDowngradeReport,
    private users: UserRepoForDowngradeReport
  ) {}

  async execute(
    input: DowngradeReportToDraftInput
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

    const domainResult = report.downgradeToDraft();

    if (!domainResult.success) {
      return failure(domainResult.error);
    }

    return this.reports.update(report);
  }
}
