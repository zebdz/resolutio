/** Builds join request received notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
import { success, collectResults, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import {
  NotificationId,
  OrganizationId,
  UserId,
} from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { User } from '../../domain/user/User';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyJoinRequestReceivedDependencies {
  ids: IdGenerator;
  clock: Clock;
  organizationRepository: OrganizationRepository;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
  userRepository: UserRepository;
}

export class NotifyJoinRequestReceivedUseCase {
  constructor(private deps: NotifyJoinRequestReceivedDependencies) {}

  async execute(input: {
    organizationId: OrganizationId;
    requesterUserId: UserId;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const { organizationId, requesterUserId } = input;

    const [organization, requester] = await Promise.all([
      this.deps.organizationRepository.findById(organizationId),
      this.deps.userRepository.findById(requesterUserId),
    ]);

    if (!organization || !requester) {
      return success(undefined);
    }

    const adminUserIds =
      await this.deps.organizationRepository.findAdminUserIds(organizationId);

    if (adminUserIds.length === 0) {
      return success(undefined);
    }

    const requesterName = User.formatFullName(
      requester.firstName,
      requester.lastName,
      requester.middleName
    );

    const notifications = collectResults(
      adminUserIds.map((userId) =>
        Notification.create(
          {
            userId,
            type: 'join_request_received',
            title: 'notification.types.joinRequestReceived.title',
            body: 'notification.types.joinRequestReceived.body',
            data: {
              organizationId,
              organizationName: organization.name,
              requesterName,
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
}
