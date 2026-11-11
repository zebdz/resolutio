/** Numeric voting weight preserves existing arithmetic before decimal persistence.
 * Storage/receipt adapters keep their existing six-place rounding; validation never rounds. */
import { z } from 'zod';

export const MAX_VOTING_WEIGHT = 999_999_999.999999;
export const VotingWeight = z
  .number()
  .finite()
  .nonnegative()
  .max(MAX_VOTING_WEIGHT)
  .brand<'VotingWeight'>();
export type VotingWeight = z.infer<typeof VotingWeight>;
