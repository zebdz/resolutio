import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyMemberRemovedFromOrganizationDependencies {
  notificationRepository: NotificationRepository;
}

export class NotifyMemberRemovedFromOrganizationUseCase {
  constructor(private deps: NotifyMemberRemovedFromOrganizationDependencies) {}

  async execute(input: {
    removedUserId: string;
    organizationId: string;
    organizationName: string;
  }): Promise<void> {
    const result = Notification.create({
      userId: input.removedUserId,
      type: 'member_removed_from_organization',
      title: 'notification.types.memberRemovedFromOrganization.title',
      body: 'notification.types.memberRemovedFromOrganization.body',
      data: {
        organizationId: input.organizationId,
        organizationName: input.organizationName,
      },
    });

    if (result.success) {
      await this.deps.notificationRepository.save(result.value);
    }
  }
}
