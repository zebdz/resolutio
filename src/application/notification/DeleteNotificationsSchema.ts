import { NotificationId, UserId } from '@/domain/shared/EntityIds';
import { z } from 'zod';

export const DeleteNotificationsSchema = z.object({
  notificationIds: z.array(NotificationId).min(1),
  userId: UserId,
});

export type DeleteNotificationsInput = z.infer<
  typeof DeleteNotificationsSchema
>;
