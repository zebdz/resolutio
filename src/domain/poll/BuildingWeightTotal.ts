/** Theoretical ownership voting power for the in-scope assets, including ownerless ones.
 * Totals retain existing arithmetic but cannot overflow or masquerade as a single voter weight. */
import { z } from 'zod';
import { Result, success, failure } from '../shared/Result';
import { PollDomainCode, PollDomainCodes } from './PollDomainCodes';
import { DistributionType } from './DistributionType';
import { PropertyAggregation } from './PropertyAggregation';
import { WeightDistributionInput } from './WeightDistribution';

export const BuildingWeightTotal = z
  .number()
  .finite()
  .nonnegative()
  .brand<'BuildingWeightTotal'>();
export type BuildingWeightTotal = z.infer<typeof BuildingWeightTotal>;

const inputSchema = WeightDistributionInput.pick({
  distributionType: true,
  propertyAggregation: true,
  assets: true,
});
export type BuildingWeightInput = z.infer<typeof inputSchema>;

export function computeBuildingWeightTotal(
  input: BuildingWeightInput
): Result<BuildingWeightTotal | null, PollDomainCode> {
  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return failure(PollDomainCodes.INVALID_WEIGHT);
  }

  const value = theoreticalTotal(parsed.data);

  if (value === null) {
    return success(null);
  }

  const total = BuildingWeightTotal.safeParse(value);

  return total.success
    ? success(total.data)
    : failure(PollDomainCodes.INVALID_WEIGHT);
}

function theoreticalTotal(input: BuildingWeightInput): number | null {
  if (input.distributionType === DistributionType.EQUAL) {
    return null;
  }

  if (
    input.propertyAggregation === PropertyAggregation.NORMALIZE_PER_PROPERTY
  ) {
    return new Set(input.assets.map((asset) => asset.propertyId)).size;
  }

  switch (input.distributionType) {
    case DistributionType.OWNERSHIP_UNIT_COUNT:
      return input.assets.length;
    case DistributionType.OWNERSHIP_SIZE_WEIGHTED:
      return input.assets.reduce((sum, asset) => sum + asset.size, 0);
  }
}
