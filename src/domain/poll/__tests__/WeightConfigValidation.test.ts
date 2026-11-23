/** Weight configuration constructors reject unknown vocabulary and empty references.
 * Copying unvalidated props must not create a trusted configuration. */
import { expect, it } from 'vitest';
import { PollWeightConfig, parsePollWeightConfig } from '../PollWeightConfig';
import { PollType } from '../PollType';
import { PollDomainCodes } from '../PollDomainCodes';
import { expectSuccess } from '../../shared/__tests__/resultAssertions';
import { DistributionType } from '../DistributionType';
import { PropertyAggregation } from '../PropertyAggregation';

it('rejects an invalid property identity at construction', () => {
  expect(() =>
    PollWeightConfig.create({
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      // @ts-expect-error Runtime validation also rejects untrusted raw identifiers.
      propertyIds: [''],
    })
  ).toThrow();
});

it.each([
  {
    pollType: PollType.OPEN,
    distributionType: 'unknown',
    propertyAggregation: 'RAW_SUM',
    propertyIds: [],
    error: PollDomainCodes.POLL_OPEN_MUST_BE_EQUAL,
  },
  {
    pollType: PollType.ORGANIZATION,
    distributionType: 'unknown',
    propertyAggregation: 'RAW_SUM',
    propertyIds: [],
    error: PollDomainCodes.DISTRIBUTION_TYPE_INVALID,
  },
  {
    pollType: PollType.ORGANIZATION,
    distributionType: 'EQUAL',
    propertyAggregation: 'unknown',
    propertyIds: [],
    error: PollDomainCodes.PROPERTY_AGGREGATION_INVALID,
  },
  {
    pollType: PollType.ORGANIZATION,
    distributionType: 'EQUAL',
    propertyAggregation: 'RAW_SUM',
    propertyIds: [''],
    error: PollDomainCodes.PROPERTY_NOT_IN_ORG,
  },
])('preserves the boundary failure $error', ({ pollType, error, ...input }) => {
  expect(parsePollWeightConfig(pollType, input)).toEqual({
    success: false,
    error,
  });
});

it('decodes valid request vocabulary without retaining mutable caller references', () => {
  const input = {
    distributionType: 'OWNERSHIP_UNIT_COUNT',
    propertyAggregation: 'NORMALIZE_PER_PROPERTY',
    propertyIds: ['property'],
  };
  const config = expectSuccess(
    parsePollWeightConfig(PollType.ORGANIZATION, input)
  );
  input.propertyIds.push('other');
  expect(config.propertyIds).toEqual(['property']);
  expect(PollWeightConfig.create(config).distributionType).toBe(
    DistributionType.OWNERSHIP_UNIT_COUNT
  );
});
