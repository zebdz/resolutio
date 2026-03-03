import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyJoinRequestRejectedDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyJoinRequestRejectedUseCase {
  constructor(private deps: NotifyJoinRequestRejectedDependencies) {}

  async execute(input: {
    organizationId: string;
    requesterUserId: string;
    rejectionReason: string;
  }): Promise<void> {
    const organization = await this.deps.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return;
    }

    const bodyKey = input.rejectionReason
      ? 'notification.types.joinRequestRejected.bodyWithReason'
      : 'notification.types.joinRequestRejected.body';

    const result = Notification.create({
      userId: input.requesterUserId,
      type: 'join_request_rejected',
      title: 'notification.types.joinRequestRejected.title',
      body: bodyKey,
      data: {
        organizationId: input.organizationId,
        organizationName: organization.name,
        rejectionReason: input.rejectionReason,
      },
    });

    if (result.success) {
      await this.deps.notificationRepository.save(result.value);
    }
  }
}
