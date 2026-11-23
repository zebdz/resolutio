/** Explicit post-commit integration port. A handler failure is reported separately
 * from the committed finish; reconciliation can recover interrupted sealing. */
import { z } from 'zod';
import { PollFinished } from '@/domain/poll/PollFinished';
import { Result } from '@/domain/shared/Result';
export const PollFinishedFailureCode = z
  .string()
  .min(1)
  .brand<'PollFinishedFailureCode'>();
export type PollFinishedFailureCode = z.infer<typeof PollFinishedFailureCode>;
export interface PollFinishedHandler {
  handle(event: PollFinished): Promise<Result<void, PollFinishedFailureCode>>;
}
