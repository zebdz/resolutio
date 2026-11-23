/** Failures exposed by the new atomic poll persistence ports. Domain decisions
 * retain their codes; missing rows and unexpected I/O failures are explicit alternatives. */
import { PollDomainCode } from './PollDomainCodes';

export type PollWriteFailure =
  | PollDomainCode
  | 'poll.errors.pollNotFound'
  | 'common.errors.unexpected';
