/** Builds property claim approved notifications with explicit creation identity/time.
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

export interface NotifyPropertyClaimApprovedDependencies {
  ids: IdGenerator;
  clock: Clock;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
  claimRepository: Pick<PropertyClaimRepository, 'findById'>;
}

export class NotifyPropertyClaimApprovedUseCase {
  constructor(private deps: NotifyPropertyClaimApprovedDependencies) {}

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

    const n = Notification.create(
      {
        userId: claimRes.value.userId,
        type: 'property_claim_approved',
        title: 'notification.types.propertyClaimApproved.title',
        body: 'notification.types.propertyClaimApproved.body',
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

    const saved = await this.deps.notificationRepository.save(n.value);

    return saved.success ? success(undefined) : saved;
  }
}
