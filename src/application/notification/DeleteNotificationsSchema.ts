import { z } from 'zod';

export const DeleteNotificationsSchema = z.object({
  notificationIds: z.array(z.string().min(1)).min(1),
  userId: z.string().min(1),
});

export type DeleteNotificationsInput = z.infer<
  typeof DeleteNotificationsSchema
>;
