/** Optimistic persistence revision. It changes only when a saved poll is loaded
 * again; stale aggregate instances cannot overwrite a newer lifecycle state. */
import { z } from 'zod';
export const PollRevision = z
  .number()
  .int()
  .nonnegative()
  .max(2147483647)
  .brand<'PollRevision'>();
export type PollRevision = z.infer<typeof PollRevision>;
