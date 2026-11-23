/** Builds property claim submitted notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
import { success, failure, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import { NotificationId, PropertyClaimId } from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';

export interface NotifyPropertyClaimSubmittedDependencies {
  ids: IdGenerator;
  clock: Clock;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
  claimRepository: Pick<
    PropertyClaimRepository,
    'findById' | 'getOrgAdminUserIds'
  >;
}

export class NotifyPropertyClaimSubmittedUseCase {
  constructor(private deps: NotifyPropertyClaimSubmittedDependencies) {}

  async execute(input: {
    claimId: PropertyClaimId;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const claimRes = await this.deps.claimRepository.findById(input.claimId);

    if (!claimRes.success) {
      return failure('common.errors.unexpected');
    }

    if (!claimRes.value) {
      return success(undefined);
    }

    const admins = await this.deps.claimRepository.getOrgAdminUserIds(
      claimRes.value.organizationId
    );

    if (!admins.success) {
      return failure('common.errors.unexpected');
    }

    if (admins.value.length === 0) {
      return success(undefined);
    }

    const notifications: Notification[] = [];

    for (const adminUserId of admins.value) {
      const n = Notification.create(
        {
          userId: adminUserId,
          type: 'property_claim_submitted',
          title: 'notification.types.propertyClaimSubmitted.title',
          body: 'notification.types.propertyClaimSubmitted.body',
          data: {
            claimId: claimRes.value.id,
            organizationId: claimRes.value.organizationId,
            assetId: claimRes.value.assetId,
          },
        },
        entityCreation(NotificationId, this.deps.ids, this.deps.clock)
      );

      if (!n.success) {
        return n;
      }

      notifications.push(n.value);
    }

    return this.deps.notificationRepository.saveBatch(notifications);
  }
}
