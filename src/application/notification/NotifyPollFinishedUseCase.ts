/** Builds poll finished notifications with explicit creation identity/time.
 * An available seal digest selects the sealed message. Construction and storage failures return Results; an empty audience succeeds. */
import { Digest } from '@/domain/seal/SealValues';
import {
  success,
  failure,
  collectResults,
  type Result,
} from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import { NotificationId, PollId } from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyPollFinishedDependencies {
  ids: IdGenerator;
  clock: Clock;
  participantRepository: ParticipantRepository;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyPollFinishedUseCase {
  constructor(private deps: NotifyPollFinishedDependencies) {}

  async execute(input: {
    pollId: PollId;
    pollTitle: string;
    rootDigest?: Digest;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const { pollId, pollTitle } = input;

    const participantsResult =
      await this.deps.participantRepository.getParticipants(pollId);

    if (!participantsResult.success) {
      return failure('common.errors.unexpected');
    }

    const participants = participantsResult.value;

    if (participants.length === 0) {
      return success(undefined);
    }

    const notifications = collectResults(
      participants.map((p) =>
        Notification.create(
          {
            userId: p.userId,
            type: 'poll_finished',
            title: 'notification.types.pollFinished.title',
            ...(input.rootDigest
              ? {
                  body: 'notification.types.pollFinished.sealedBody' as const,
                  data: { pollId, pollTitle, rootDigest: input.rootDigest },
                }
              : {
                  body: 'notification.types.pollFinished.body' as const,
                  data: { pollId, pollTitle },
                }),
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
