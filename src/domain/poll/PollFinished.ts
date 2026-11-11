/** Raised by the poll transition; consumers dispatch only after persistence.
 * Validated scalar values keep this event immutable and reject invalid evidence. */
import { PollId, PollInstant } from './PollValues';

export interface PollFinished {
  readonly type: 'PollFinished';
  readonly pollId: PollId;
  readonly finishedAt: PollInstant;
}
