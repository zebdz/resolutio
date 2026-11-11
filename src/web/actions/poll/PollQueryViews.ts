/** Plain poll read payloads shared by actions and their page/list consumers.
 * Snapshot brands retain meaning in TypeScript; Dates and scalar wire values are unchanged. */
import type { PollSnapshot } from '@/domain/poll/Poll';
import type { ResultCount } from '@/domain/shared/Pagination';

export type UserPollView = PollSnapshot & {
  canVote: boolean;
  hasFinishedVoting: boolean;
};

export type PollListItem = UserPollView & {
  organizationName: string;
  isOrgArchived: boolean;
  boardName: string;
  isBoardArchived: boolean;
};

export interface PollSearchView {
  polls: PollListItem[];
  totalCount: ResultCount;
}
