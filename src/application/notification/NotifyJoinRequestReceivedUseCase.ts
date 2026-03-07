import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { User } from '../../domain/user/User';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyJoinRequestReceivedDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
  userRepository: UserRepository;
}

export class NotifyJoinRequestReceivedUseCase {
  constructor(private deps: NotifyJoinRequestReceivedDependencies) {}

  async execute(input: {
    organizationId: string;
    requesterUserId: string;
  }): Promise<void> {
    const { organizationId, requesterUserId } = input;

    const [organization, requester] = await Promise.all([
      this.deps.organizationRepository.findById(organizationId),
      this.deps.userRepository.findById(requesterUserId),
    ]);

    if (!organization || !requester) {
      return;
    }

    const adminUserIds =
      await this.deps.organizationRepository.findAdminUserIds(organizationId);

    if (adminUserIds.length === 0) {
      return;
    }

    const requesterName = User.formatFullName(
      requester.firstName,
      requester.lastName,
      requester.middleName
    );

    const notifications = adminUserIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'join_request_received',
          title: 'notification.types.joinRequestReceived.title',
          body: 'notification.types.joinRequestReceived.body',
          data: {
            organizationId,
            organizationName: organization.name,
            requesterName,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
