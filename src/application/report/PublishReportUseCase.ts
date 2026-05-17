import { Result, failure, success } from '../../domain/shared/Result';
import { Report } from '../../domain/report/Report';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ReportErrors } from './ReportErrors';

export interface OrgRepoForPublishReport {
  isUserAdmin(userId: string, orgId: string): Promise<boolean>;
}

export interface UserRepoForPublishReport {
  isSuperAdmin(userId: string): Promise<boolean>;
}

export interface NotifyForPublishReport {
  notifyPublished(report: Report): Promise<void>;
}

export interface PublishReportInput {
  reportId: string;
  callerId: string;
  notifyAudience: boolean;
}

export class PublishReportUseCase {
  constructor(
    private reports: ReportRepository,
    private orgs: OrgRepoForPublishReport,
    private users: UserRepoForPublishReport,
    private notify: NotifyForPublishReport
  ) {}

  async execute(input: PublishReportInput): Promise<Result<void, string>> {
    const lookup = await this.reports.findByIdWithRelations(input.reportId);

    if (!lookup.success) {
      return failure(lookup.error);
    }

    if (!lookup.value) {
      return failure(ReportErrors.REPORT_NOT_FOUND);
    }

    const report = lookup.value;

    const isAdmin = await this.orgs.isUserAdmin(
      input.callerId,
      report.organizationId
    );
    const isSuper = !isAdmin && (await this.users.isSuperAdmin(input.callerId));

    if (!isAdmin && !isSuper) {
      return failure(ReportErrors.NOT_ORG_ADMIN);
    }

    const domainResult = report.publish(input.callerId, input.notifyAudience);

    if (!domainResult.success) {
      return failure(domainResult.error);
    }

    const updateResult = await this.reports.update(report);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    if (report.notifyAudience) {
      try {
        await this.notify.notifyPublished(report);
      } catch (err) {
        console.error(
          '[PublishReportUseCase] notify.notifyPublished failed',
          err
        );
      }
    }

    return success(undefined);
  }
}
