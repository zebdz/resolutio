/** Poll content access for authenticated viewers, independent of casting eligibility.
 * Organization members/admins may read ordinary polls; open polls are readable by link. */
import { Poll } from './Poll';

export interface PollReaderFacts {
  readonly isAdmin: boolean;
  readonly isOrgMember: boolean;
}

export const PollReadPolicy = {
  canViewPoll(poll: Poll, facts: PollReaderFacts): boolean {
    return poll.isOpen() || facts.isAdmin || facts.isOrgMember;
  },
};
