import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyAdminRemovedDependencies {
  notificationRepository: NotificationRepository;
}

export class NotifyAdminRemovedUseCase {
  constructor(private deps: NotifyAdminRemovedDependencies) {}

  async execute(input: {
    removedUserId: string;
    organizationId: string;
    organizationName: string;
    actorName: string;
  }): Promise<void> {
    const result = Notification.create({
      userId: input.removedUserId,
      type: 'admin_removed',
      title: 'notification.types.adminRemoved.title',
      body: 'notification.types.adminRemoved.body',
      data: {
        organizationId: input.organizationId,
        organizationName: input.organizationName,
        actorName: input.actorName,
      },
    });

    if (result.success) {
      await this.deps.notificationRepository.save(result.value);
    }
  }
}
