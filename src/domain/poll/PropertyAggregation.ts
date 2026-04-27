import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes } from './PollDomainCodes';

export const PropertyAggregation = {
  RAW_SUM: 'RAW_SUM',
  NORMALIZE_PER_PROPERTY: 'NORMALIZE_PER_PROPERTY',
} as const;

export type PropertyAggregation =
  (typeof PropertyAggregation)[keyof typeof PropertyAggregation];

export function parsePropertyAggregation(
  value: string
): Result<PropertyAggregation, string> {
  if (
    value === PropertyAggregation.RAW_SUM ||
    value === PropertyAggregation.NORMALIZE_PER_PROPERTY
  ) {
    return success(value);
  }

  return failure(PollDomainCodes.PROPERTY_AGGREGATION_INVALID);
}
