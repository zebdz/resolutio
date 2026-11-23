/** A nominal, immutable poll period validates both endpoints and their ordering.
 * Raw Date inputs are decoded together before creation or an aggregate edit. */
import { Instant } from '../shared/Instant';
import { Result, failure, success } from '../shared/Result';
import { PollDomainCode, PollDomainCodes } from './PollDomainCodes';

export class PollPeriod {
  private readonly startAt: Instant;
  private readonly endAt: Instant;

  private constructor(start: Instant, end: Instant) {
    this.startAt = Instant.parse(start);
    this.endAt = Instant.parse(end);

    if (this.startAt >= this.endAt) {
      throw new Error(PollDomainCodes.POLL_INVALID_DATES);
    }

    Object.freeze(this);
  }

  get start(): Instant {
    return this.startAt;
  }
  get end(): Instant {
    return this.endAt;
  }

  static create(start: Date, end: Date): Result<PollPeriod, PollDomainCode> {
    try {
      const from = Instant.fromDate(start);
      const to = Instant.fromDate(end);

      return success(new PollPeriod(from, to));
    } catch {
      return failure(PollDomainCodes.POLL_INVALID_DATES);
    }
  }
}
