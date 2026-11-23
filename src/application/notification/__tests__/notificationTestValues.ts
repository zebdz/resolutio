/** Deterministic creation ports and valid content for notification client fixtures. */
import { Instant } from '@/domain/shared/Instant';
import { PollId } from '@/domain/shared/EntityIds';
import { NotificationContent } from '@/domain/notification/NotificationContent';
let sequence = 0;
export const notificationTestInputs = {
  ids: {
    generate: <Id extends string>(schema: { parse(value: unknown): Id }): Id =>
      schema.parse(`fixture-${++sequence}`),
  },
  clock: { now: () => Instant.parse('2026-01-01T00:00:00.000Z') },
};
export const notificationTestContent = NotificationContent.parse({
  type: 'poll_finished',
  title: 'notification.types.pollFinished.title',
  body: 'notification.types.pollFinished.body',
  data: { pollId: PollId.parse('poll-1'), pollTitle: 'Poll' },
});
