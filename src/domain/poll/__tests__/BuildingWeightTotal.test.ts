/** Domain clients calculate the theoretical building denominator independently of storage.
 * Aggregate totals preserve existing arithmetic and remain distinct from individual weights. */
import { expect, it } from 'vitest';
import { AssetId, PropertyId } from '../../shared/EntityIds';
import { AssetSize } from '../../organization/PropertyValues';
import { success } from '../../shared/Result';
import { DistributionType } from '../DistributionType';
import { PropertyAggregation } from '../PropertyAggregation';
import {
  BuildingWeightTotal,
  computeBuildingWeightTotal,
} from '../BuildingWeightTotal';

it('sums in-scope sizes without applying an individual voter weight cap or rounding', () => {
  const assets = [1_000_000_000.125, 0.25].map((size, index) => ({
    id: AssetId.parse(`asset-${index}`),
    propertyId: PropertyId.parse('property'),
    size: AssetSize.parse(size),
  }));
  expect(
    computeBuildingWeightTotal({
      distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      assets,
    })
  ).toEqual(success(BuildingWeightTotal.parse(1_000_000_000.375)));
});

it('distinguishes an inapplicable EQUAL denominator from an empty ownership scope', () => {
  expect(
    computeBuildingWeightTotal({
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      assets: [],
    })
  ).toEqual(success(null));
  expect(
    computeBuildingWeightTotal({
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      assets: [],
    })
  ).toEqual(success(BuildingWeightTotal.parse(0)));
});
