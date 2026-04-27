import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';

export interface NotifyPropertyClaimApprovedDependencies {
  notificationRepository: NotificationRepository;
  claimRepository: PropertyClaimRepository;
}

export class NotifyPropertyClaimApprovedUseCase {
  constructor(private deps: NotifyPropertyClaimApprovedDependencies) {}

  async execute(input: { claimId: string }): Promise<void> {
    const claimRes = await this.deps.claimRepository.findById(input.claimId);

    if (!claimRes.success || !claimRes.value) {
      return;
    }

    const n = Notification.create({
      userId: claimRes.value.userId,
      type: 'property_claim_approved',
      title: 'notification.types.propertyClaimApproved.title',
      body: 'notification.types.propertyClaimApproved.body',
      data: {
        claimId: claimRes.value.id,
        organizationId: claimRes.value.organizationId,
        assetId: claimRes.value.assetId,
      },
    });

    if (!n.success) {
      return;
    }

    await this.deps.notificationRepository.save(n.value);
  }
}
