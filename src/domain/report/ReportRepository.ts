/** Report persistence port carries validated references and query units.
 * Raw storage records are decoded by adapters before they become aggregates. */
import { Instant } from '../shared/Instant';
import { ReportId, OrganizationId, UserId, PollId } from '../shared/EntityIds';
import { PageNumber, PageSize, ResultCount } from '../shared/Pagination';
import { Report } from './Report';
import { ReportVisibility } from './ReportVisibility';
import { Result } from '../shared/Result';

export interface ReportSearchFilters {
  organizationIds?: OrganizationId[];
  visibilities?: ReportVisibility[];
  state?: 'DRAFT' | 'PUBLISHED';
  includeArchived?: boolean;
  authorId?: UserId;
  attachedPollId?: PollId;
  page?: PageNumber;
  pageSize?: PageSize;
}

export interface ReportSearchResult {
  reports: Report[];
  totalCount: ResultCount;
}

export interface ReportRepository {
  create(report: Report): Promise<Result<Report, 'common.errors.unexpected'>>;
  update(report: Report): Promise<Result<void, 'common.errors.unexpected'>>;
  findById(
    id: ReportId
  ): Promise<Result<Report | null, 'common.errors.unexpected'>>;
  /**
   * Hydrate full Report including boards, polls, and attachment ids.
   */
  findByIdWithRelations(
    id: ReportId
  ): Promise<Result<Report | null, 'common.errors.unexpected'>>;
  /**
   * List public-anon PUBLISHED non-archived reports for sitemap generation.
   * Returns ids + lastPublishedAt only — no body / attachments.
   */
  listPublicAnonForSitemap(): Promise<
    Result<
      Array<{ id: ReportId; lastPublishedAt: Instant }>,
      'common.errors.unexpected'
    >
  >;
  search(
    filters: ReportSearchFilters
  ): Promise<Result<ReportSearchResult, 'common.errors.unexpected'>>;
}
