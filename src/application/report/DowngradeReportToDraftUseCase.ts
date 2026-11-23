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
import { ReportErrors } from './ReportErrors';

export interface OrgRepoForDowngradeReport {
  isUserAdmin(userId: UserId, orgId: OrganizationId): Promise<boolean>;
}

export interface UserRepoForDowngradeReport {
  isSuperAdmin(userId: UserId): Promise<boolean>;
}

export interface DowngradeReportToDraftInput {
  reportId: string;
  callerId: string;
}

export class DowngradeReportToDraftUseCase {
  constructor(
    private reports: ReportRepository,
    private orgs: OrgRepoForDowngradeReport,
    private users: UserRepoForDowngradeReport,
    private clock: Clock
  ) {}

  async execute(
    input: DowngradeReportToDraftInput
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

    const domainResult = report.downgradeToDraft(this.clock.now());

    if (!domainResult.success) {
      return failure(domainResult.error);
    }

    return this.reports.update(report);
  }
}
