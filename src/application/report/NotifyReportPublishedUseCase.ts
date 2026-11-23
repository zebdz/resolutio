/** Resolves typed report recipients and creates notifications with explicit identity/time. */
import {
  NotificationId,
  UserId,
  OrganizationId,
  BoardId,
} from '../../domain/shared/EntityIds';
import { Clock, IdGenerator, entityCreation } from '../shared/EntityCreation';
import { Report } from '../../domain/report/Report';
import { ReportVisibility } from '../../domain/report/ReportVisibility';
import { Notification } from '../../domain/notification/Notification';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { collectResults, success, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from '@/application/notification/NotificationErrors';

export interface OrgRepoForNotify {
  getAncestorIds(orgId: OrganizationId): Promise<OrganizationId[]>;
  getDescendantIds(orgId: OrganizationId): Promise<OrganizationId[]>;
  getFullTreeOrgIds(orgId: OrganizationId): Promise<OrganizationId[]>;
  findAcceptedMemberUserIdsForOrgs(orgIds: OrganizationId[]): Promise<UserId[]>;
}

export interface BoardRepoForNotify {
  findBoardMembers(boardId: BoardId): Promise<{ userId: UserId }[]>;
}

export class NotifyReportPublishedUseCase {
  constructor(
    private deps: {
      ids: IdGenerator;
      clock: Clock;
      orgRepo: OrgRepoForNotify;
      boardRepo: BoardRepoForNotify;
      notificationRepository: Pick<NotificationRepository, 'saveBatch'>;
    }
  ) {}

  async notifyPublished(
    report: Report
  ): Promise<Result<void, NotificationDeliveryFailure>> {
    const audience = await this.resolveAudience(report);
    // Skip the author — they already know.
    const recipients = audience.filter((id) => id !== report.createdById);

    if (recipients.length === 0) {
      return success(undefined);
    }

    const notifications = collectResults(
      recipients.map((userId) =>
        Notification.create(
          {
            userId,
            type: 'report_published',
            title: 'notification.types.reportPublished.title',
            body: 'notification.types.reportPublished.body',
            data: {
              reportId: report.id,
              organizationId: report.organizationId,
              title: report.title,
            },
          },
          entityCreation(NotificationId, this.deps.ids, this.deps.clock)
        )
      )
    );

    if (!notifications.success) {
      return notifications;
    }

    return this.deps.notificationRepository.saveBatch(notifications.value);
  }

  private async resolveAudience(report: Report): Promise<UserId[]> {
    switch (report.visibility) {
      case ReportVisibility.PUBLIC_ANON:
      case ReportVisibility.PUBLIC_AUTH:
        return [];
      case ReportVisibility.WITHIN_ORG_ONLY:
        return this.deps.orgRepo.findAcceptedMemberUserIdsForOrgs([
          report.organizationId,
        ]);

      case ReportVisibility.WITHIN_ORG_ANCESTORS: {
        const ancestors = await this.deps.orgRepo.getAncestorIds(
          report.organizationId
        );

        return this.deps.orgRepo.findAcceptedMemberUserIdsForOrgs([
          report.organizationId,
          ...ancestors,
        ]);
      }

      case ReportVisibility.WITHIN_ORG_DESCENDANTS: {
        const descendants = await this.deps.orgRepo.getDescendantIds(
          report.organizationId
        );

        return this.deps.orgRepo.findAcceptedMemberUserIdsForOrgs([
          report.organizationId,
          ...descendants,
        ]);
      }

      case ReportVisibility.WITHIN_ORG_TREE: {
        const tree = await this.deps.orgRepo.getFullTreeOrgIds(
          report.organizationId
        );

        return this.deps.orgRepo.findAcceptedMemberUserIdsForOrgs([
          report.organizationId,
          ...tree,
        ]);
      }

      case ReportVisibility.WITHIN_BOARDS: {
        const seen = new Set<UserId>();

        for (const boardId of report.boardIds) {
          const members = await this.deps.boardRepo.findBoardMembers(boardId);

          for (const m of members) {
            seen.add(m.userId);
          }
        }

        return [...seen];
      }

      default:
        return [];
    }
  }
}
