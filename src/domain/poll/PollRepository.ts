import { Poll } from './Poll';
import { PollState } from './PollState';
import { Result } from '../shared/Result';

export interface PollSearchFilters {
  titleSearch?: string;
  statuses?: PollState[];
  organizationId?: string;
  boardId?: string;
  orgWideOnly?: boolean;
  createdFrom?: Date;
  createdTo?: Date;
  startFrom?: Date;
  startTo?: Date;
  page?: number;
  pageSize?: number;
}

export interface PollRepository {
  createPoll(poll: Poll): Promise<Result<Poll, string>>;
  getPollById(pollId: string): Promise<Result<Poll | null, string>>;
  getPollsByBoardId(boardId: string): Promise<Result<Poll[], string>>;
  getPollsByOrganizationId(orgId: string): Promise<Result<Poll[], string>>;
  getPollsByUserId(userId: string): Promise<Result<Poll[], string>>;
  searchPolls(
    filters: PollSearchFilters,
    userId?: string,
    adminOrgIds?: string[]
  ): Promise<Result<{ polls: Poll[]; totalCount: number }, string>>;
  updatePoll(poll: Poll): Promise<Result<void, string>>;
  deletePoll(pollId: string): Promise<Result<void, string>>;
}
