import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyJoinRequestAcceptedDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyJoinRequestAcceptedUseCase {
  constructor(private deps: NotifyJoinRequestAcceptedDependencies) {}

  async execute(input: {
    organizationId: string;
    requesterUserId: string;
  }): Promise<void> {
    const organization = await this.deps.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return;
    }

    const result = Notification.create({
      userId: input.requesterUserId,
      type: 'join_request_accepted',
      title: 'notification.types.joinRequestAccepted.title',
      body: 'notification.types.joinRequestAccepted.body',
      data: {
        organizationId: input.organizationId,
        organizationName: organization.name,
      },
    });

    if (result.success) {
      await this.deps.notificationRepository.save(result.value);
    }
  }
}
