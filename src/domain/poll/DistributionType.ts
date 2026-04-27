import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes } from './PollDomainCodes';

export const DistributionType = {
  EQUAL: 'EQUAL',
  OWNERSHIP_UNIT_COUNT: 'OWNERSHIP_UNIT_COUNT',
  OWNERSHIP_SIZE_WEIGHTED: 'OWNERSHIP_SIZE_WEIGHTED',
} as const;

export type DistributionType =
  (typeof DistributionType)[keyof typeof DistributionType];

export function parseDistributionType(
  value: string
): Result<DistributionType, string> {
  if (
    value === DistributionType.EQUAL ||
    value === DistributionType.OWNERSHIP_UNIT_COUNT ||
    value === DistributionType.OWNERSHIP_SIZE_WEIGHTED
  ) {
    return success(value);
  }

  return failure(PollDomainCodes.DISTRIBUTION_TYPE_INVALID);
}

export function isOwnershipMode(type: DistributionType): boolean {
  return (
    type === DistributionType.OWNERSHIP_UNIT_COUNT ||
    type === DistributionType.OWNERSHIP_SIZE_WEIGHTED
  );
}
