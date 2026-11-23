/** Numeric result units keep aggregate weights distinct from individual weights
 * and counts. Arithmetic preserves the existing order, precision and zero handling. */
import { z } from 'zod';
import { VotingWeight } from './VotingWeight';

export const VoteCount = z.number().int().nonnegative().brand<'VoteCount'>();
export type VoteCount = z.infer<typeof VoteCount>;
export const ParticipantCount = z
  .number()
  .int()
  .nonnegative()
  .brand<'ParticipantCount'>();
export type ParticipantCount = z.infer<typeof ParticipantCount>;
export const TotalVotingWeight = z
  .number()
  .finite()
  .nonnegative()
  .brand<'TotalVotingWeight'>();
export type TotalVotingWeight = z.infer<typeof TotalVotingWeight>;
// A sum across multiple-choice answers may exceed the electorate's weight.
// Percentages keep their unit without introducing a new cap or rounding rule.
export const VotingPercentage = z
  .number()
  .finite()
  .nonnegative()
  .brand<'VotingPercentage'>();
export type VotingPercentage = z.infer<typeof VotingPercentage>;

export function sumVotingWeights(
  weights: readonly (VotingWeight | TotalVotingWeight)[]
): TotalVotingWeight {
  return TotalVotingWeight.parse(
    weights.reduce((sum, weight) => sum + weight, 0)
  );
}

export function percentageOfWeight(
  weight: TotalVotingWeight,
  electorate: TotalVotingWeight
): VotingPercentage {
  return VotingPercentage.parse(
    electorate > 0 ? (weight / electorate) * 100 : 0
  );
}
