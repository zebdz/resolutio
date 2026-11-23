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
import { Result, failure, success } from '../../domain/shared/Result';
import { Report } from '../../domain/report/Report';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ReportErrors } from './ReportErrors';
import type { NotificationDeliveryFailure } from '@/application/notification/NotificationErrors';

export interface OrgRepoForPublishReport {
  isUserAdmin(userId: UserId, orgId: OrganizationId): Promise<boolean>;
}

export interface UserRepoForPublishReport {
  isSuperAdmin(userId: UserId): Promise<boolean>;
}

export interface NotifyForPublishReport {
  notifyPublished(
    report: Report
  ): Promise<Result<void, NotificationDeliveryFailure>>;
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
    private notify: NotifyForPublishReport,
    private clock: Clock
  ) {}

  async execute(
    input: PublishReportInput
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

    const isAdmin = await this.orgs.isUserAdmin(
      command.callerId,
      report.organizationId
    );
    const isSuper =
      !isAdmin && (await this.users.isSuperAdmin(command.callerId));

    if (!isAdmin && !isSuper) {
      return failure(ReportErrors.NOT_ORG_ADMIN);
    }

    const domainResult = report.publish(
      command.callerId,
      command.notifyAudience,
      this.clock.now()
    );

    if (!domainResult.success) {
      return failure(domainResult.error);
    }

    const updateResult = await this.reports.update(report);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    if (report.notifyAudience) {
      try {
        const delivered = await this.notify.notifyPublished(report);

        if (!delivered.success) {
          console.error(
            '[PublishReportUseCase] notify.notifyPublished failed',
            delivered.error
          );
        }
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
