import { Report } from '../../domain/report/Report';
import { ReportVisibility } from '../../domain/report/ReportVisibility';
import { Notification } from '../../domain/notification/Notification';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';

export interface OrgRepoForNotify {
  getAncestorIds(orgId: string): Promise<string[]>;
  getDescendantIds(orgId: string): Promise<string[]>;
  getFullTreeOrgIds(orgId: string): Promise<string[]>;
  findAcceptedMemberUserIdsForOrgs(orgIds: string[]): Promise<string[]>;
}

export interface BoardRepoForNotify {
  findBoardMembers(boardId: string): Promise<{ userId: string }[]>;
}

export class NotifyReportPublishedUseCase {
  constructor(
    private deps: {
      orgRepo: OrgRepoForNotify;
      boardRepo: BoardRepoForNotify;
      notificationRepository: NotificationRepository;
    }
  ) {}

  async notifyPublished(report: Report): Promise<void> {
    const audience = await this.resolveAudience(report);
    // Skip the author — they already know.
    const recipients = audience.filter((id) => id !== report.createdById);

    if (recipients.length === 0) {
      return;
    }

    const notifications = recipients.map((userId) => {
      const result = Notification.create({
        userId,
        type: 'report_published',
        title: 'notification.types.reportPublished.title',
        body: 'notification.types.reportPublished.body',
        data: {
          reportId: report.id,
          organizationId: report.organizationId,
          title: report.title,
        },
      });

      // Notification.create always returns success in current impl.
      if (!result.success) {
        throw new Error(`Notification.create failed: ${result.error}`);
      }

      return result.value;
    });

    await this.deps.notificationRepository.saveBatch(notifications);
  }

  private async resolveAudience(report: Report): Promise<string[]> {
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
        const seen = new Set<string>();

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
