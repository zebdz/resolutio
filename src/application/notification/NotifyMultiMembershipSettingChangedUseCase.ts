import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyMultiMembershipSettingChangedDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyMultiMembershipSettingChangedUseCase {
  constructor(private deps: NotifyMultiMembershipSettingChangedDependencies) {}

  async execute(input: { rootOrgId: string; allowed: boolean }): Promise<void> {
    const { rootOrgId, allowed } = input;

    const rootOrg = await this.deps.organizationRepository.findById(rootOrgId);

    if (!rootOrg) {
      return;
    }

    const memberUserIds =
      await this.deps.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
        rootOrgId
      );

    if (memberUserIds.length === 0) {
      return;
    }

    const notifications = memberUserIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'multi_membership_setting_changed',
          title: 'notification.types.multiMembershipSettingChanged.title',
          body: 'notification.types.multiMembershipSettingChanged.body',
          data: {
            organizationId: rootOrgId,
            organizationName: rootOrg.name,
            allowed,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
