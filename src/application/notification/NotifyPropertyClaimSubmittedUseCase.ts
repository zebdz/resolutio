import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';

export interface NotifyPropertyClaimSubmittedDependencies {
  notificationRepository: NotificationRepository;
  claimRepository: PropertyClaimRepository;
}

export class NotifyPropertyClaimSubmittedUseCase {
  constructor(private deps: NotifyPropertyClaimSubmittedDependencies) {}

  async execute(input: { claimId: string }): Promise<void> {
    const claimRes = await this.deps.claimRepository.findById(input.claimId);

    if (!claimRes.success || !claimRes.value) {
      return;
    }

    const admins = await this.deps.claimRepository.getOrgAdminUserIds(
      claimRes.value.organizationId
    );

    if (!admins.success || admins.value.length === 0) {
      return;
    }

    const notifications: Notification[] = [];

    for (const adminUserId of admins.value) {
      const n = Notification.create({
        userId: adminUserId,
        type: 'property_claim_submitted',
        title: 'notification.types.propertyClaimSubmitted.title',
        body: 'notification.types.propertyClaimSubmitted.body',
        data: {
          claimId: claimRes.value.id,
          organizationId: claimRes.value.organizationId,
          assetId: claimRes.value.assetId,
        },
      });

      if (n.success) {
        notifications.push(n.value);
      }
    }

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
