/** Poll persistence accepts decoded references and validated query units.
 * Infrastructure maps raw database rows; callers receive complete aggregates. */
import { PollId, BoardId, OrganizationId, UserId } from '../shared/EntityIds';
import { PageNumber, PageSize, ResultCount } from '../shared/Pagination';
import { Instant } from '../shared/Instant';
import { PollWriteFailure } from './PollWriteFailure';
import { Poll } from './Poll';
import { PollState } from './PollState';
import { Result } from '../shared/Result';

export interface PollSearchFilters {
  titleSearch?: string;
  statuses?: PollState[];
  organizationId?: OrganizationId;
  boardId?: BoardId;
  orgWideOnly?: boolean;
  createdFrom?: Instant;
  createdTo?: Instant;
  startFrom?: Instant;
  startTo?: Instant;
  page?: PageNumber;
  pageSize?: PageSize;
}

export interface PollRepository {
  createPoll(poll: Poll): Promise<Result<Poll, PollWriteFailure>>;
  getPollById(pollId: PollId): Promise<Result<Poll | null, PollWriteFailure>>;
  getPollsByBoardId(
    boardId: BoardId
  ): Promise<Result<Poll[], PollWriteFailure>>;
  getPollsByOrganizationId(
    orgId: OrganizationId
  ): Promise<Result<Poll[], PollWriteFailure>>;
  getPollsByUserId(userId: UserId): Promise<Result<Poll[], PollWriteFailure>>;
  searchPolls(
    filters: PollSearchFilters,
    userId?: UserId,
    adminOrgIds?: OrganizationId[]
  ): Promise<
    Result<{ polls: Poll[]; totalCount: ResultCount }, PollWriteFailure>
  >;
  /** Persists the poll with a loaded-revision check; reload after saving.
   * Participant snapshot changes require their explicit transaction port. */
  updatePoll(poll: Poll): Promise<Result<void, PollWriteFailure>>;
  deletePoll(pollId: PollId): Promise<Result<void, PollWriteFailure>>;
}
