/** Closed poll eligibility modes, with explicit decoding of external requests. */
import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes, PollDomainCode } from './PollDomainCodes';

export const PollType = {
  ORGANIZATION: 'ORGANIZATION',
  OPEN: 'OPEN',
} as const;

export type PollType = (typeof PollType)[keyof typeof PollType];

export function parsePollType(
  value: unknown
): Result<PollType, PollDomainCode> {
  if (value === PollType.ORGANIZATION || value === PollType.OPEN) {
    return success(value);
  }

  return failure(PollDomainCodes.POLL_TYPE_INVALID);
}
