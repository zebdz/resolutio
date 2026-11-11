/** Result quantities preserve existing weighted arithmetic without confusing a
 * participant's weight, an aggregate total, a percentage or a count. */
import { describe, expect, it } from 'vitest';
import { VotingWeight, MAX_VOTING_WEIGHT } from '../VotingWeight';
import {
  sumVotingWeights,
  percentageOfWeight,
  TotalVotingWeight,
  VoteCount,
  ParticipantCount,
} from '../ResultTallies';

describe('weighted result quantities', () => {
  it('sums weights without applying the individual cap or rounding', () => {
    const large = VotingWeight.parse(MAX_VOTING_WEIGHT);
    expect(sumVotingWeights([large, large])).toBe(MAX_VOTING_WEIGHT * 2);
    expect(
      sumVotingWeights([VotingWeight.parse(0.1), VotingWeight.parse(0.2)])
    ).toBe(0.1 + 0.2);
    expect(sumVotingWeights([])).toBe(0);
  });

  it('keeps the existing zero-denominator and percentage arithmetic', () => {
    expect(
      percentageOfWeight(TotalVotingWeight.parse(2), TotalVotingWeight.parse(6))
    ).toBe((2 / 6) * 100);
    expect(
      percentageOfWeight(TotalVotingWeight.parse(0), TotalVotingWeight.parse(0))
    ).toBe(0);
  });

  it('rejects nonfinite totals and fractional or negative counts', () => {
    expect(TotalVotingWeight.safeParse(Infinity).success).toBe(false);
    expect(TotalVotingWeight.safeParse(NaN).success).toBe(false);
    expect(TotalVotingWeight.safeParse(-1).success).toBe(false);
    expect(VoteCount.safeParse(0.5).success).toBe(false);
    expect(ParticipantCount.safeParse(-1).success).toBe(false);
  });
});
