/** Weight calculations must report values outside the ballot storage range.
 * Finite source sizes can still overflow when their contributions are summed. */
import { expect, it } from 'vitest';
import { AssetId, PropertyId, UserId } from '../../shared/EntityIds';
import { AssetSize, OwnershipShare } from '../../organization/PropertyValues';
import { computeWeights } from '../WeightDistribution';
import { DistributionType } from '../DistributionType';
import { PropertyAggregation } from '../PropertyAggregation';
import { PollDomainCodes } from '../PollDomainCodes';
import { failure } from '../../shared/Result';

it('rejects a computed weight that cannot be stored instead of returning Infinity', () => {
  const userId = UserId.parse('owner');
  const propertyId = PropertyId.parse('property');
  const assets = ['a', 'b'].map((id) => ({
    id: AssetId.parse(id),
    propertyId,
    size: AssetSize.parse(Number.MAX_VALUE),
  }));
  expect(
    computeWeights({
      candidates: [userId],
      distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets,
      ownerships: assets.map((asset) => ({
        assetId: asset.id,
        userId,
        share: OwnershipShare.parse(1),
      })),
    })
  ).toEqual(failure(PollDomainCodes.INVALID_WEIGHT));
});
