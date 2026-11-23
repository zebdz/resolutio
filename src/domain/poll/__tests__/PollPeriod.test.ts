/** Raw poll dates are decoded as one ordered period before aggregate operations. */
import { expect, it } from 'vitest';
import { PollPeriod } from '../PollPeriod';
import { PollDomainCodes } from '../PollDomainCodes';
import { failure } from '../../shared/Result';

it.each([
  [new Date(NaN), new Date('2026-02-01')],
  [new Date('2026-01-01'), new Date(NaN)],
  [new Date('2026-02-01'), new Date('2026-01-01')],
  [new Date('2026-01-01'), new Date('2026-01-01')],
  [new Date('2026-01-01'), new Date('+010000-01-01')],
])('rejects an invalid or unordered period (%s, %s)', (start, end) => {
  expect(PollPeriod.create(start, end)).toEqual(
    failure(PollDomainCodes.POLL_INVALID_DATES)
  );
});
