import { Report } from './Report';
import { ReportVisibility } from './ReportVisibility';
import { Result } from '../shared/Result';

export interface ReportSearchFilters {
  organizationIds?: string[];
  visibilities?: ReportVisibility[];
  state?: 'DRAFT' | 'PUBLISHED';
  includeArchived?: boolean;
  authorId?: string;
  attachedPollId?: string;
  page?: number;
  pageSize?: number;
}

export interface ReportSearchResult {
  reports: Report[];
  totalCount: number;
}

export interface ReportRepository {
  create(report: Report): Promise<Result<Report, string>>;
  update(report: Report): Promise<Result<void, string>>;
  findById(id: string): Promise<Result<Report | null, string>>;
  /**
   * Hydrate full Report including boards, polls, and attachment ids.
   */
  findByIdWithRelations(id: string): Promise<Result<Report | null, string>>;
  /**
   * List public-anon PUBLISHED non-archived reports for sitemap generation.
   * Returns ids + lastPublishedAt only — no body / attachments.
   */
  listPublicAnonForSitemap(): Promise<
    Result<Array<{ id: string; lastPublishedAt: Date }>, string>
  >;
  search(
    filters: ReportSearchFilters
  ): Promise<Result<ReportSearchResult, string>>;
}
