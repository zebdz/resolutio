/** The only account data the site header needs. Shared by the server and the browser decoder. */
import { z } from 'zod';

export const MemberNavigation = z.strictObject({
  firstName: z.string(),
  isSuperAdmin: z.boolean(),
  unreadNotificationCount: z.number().int().nonnegative(),
});
export type MemberNavigation = z.infer<typeof MemberNavigation>;
