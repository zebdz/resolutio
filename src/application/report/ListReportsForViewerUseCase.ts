import { Result, success, failure } from '../../domain/shared/Result';
import { Report } from '../../domain/report/Report';
import {
  ReportRepository,
  ReportSearchFilters,
} from '../../domain/report/ReportRepository';
import { ReportVisibility } from '../../domain/report/ReportVisibility';
import { Organization } from '../../domain/organization/Organization';

export interface OrgRepoForListReports {
  findMembershipsByUserId(userId: string): Promise<Organization[]>;
  findAdminOrganizationsByUserId(userId: string): Promise<Organization[]>;
}

export interface BoardRepoForListReports {
  findActiveBoardsByUserId(
    userId: string
  ): Promise<Array<{ id: string; name: string; organizationId: string }>>;
}

export interface UserRepoForListReports {
  isSuperAdmin(userId: string): Promise<boolean>;
}

export interface ListReportsForViewerInput {
  viewerId: string | null;
  organizationIds?: string[];
  page?: number;
  pageSize?: number;
}

export interface ListReportsForViewerResult {
  reports: Report[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// PERF: This implementation issues several search passes and merges in-memory.
// Consolidate into a single search when ReportRepository.search gains richer
// filter predicates (board membership, multi-audience OR clauses, etc.).

export class ListReportsForViewerUseCase {
  constructor(
    private reports: ReportRepository,
    private orgs: OrgRepoForListReports,
    private boards: BoardRepoForListReports,
    private users: UserRepoForListReports
  ) {}

  async execute(
    input: ListReportsForViewerInput
  ): Promise<Result<ListReportsForViewerResult, string>> {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;

    // -- Anonymous viewer: only PUBLIC_ANON published non-archived reports
    if (!input.viewerId) {
      const filters: ReportSearchFilters = {
        visibilities: [ReportVisibility.PUBLIC_ANON],
        state: 'PUBLISHED',
        includeArchived: false,
      };

      if (input.organizationIds && input.organizationIds.length > 0) {
        filters.organizationIds = input.organizationIds;
      }

      const result = await this.reports.search(filters);

      if (!result.success) {
        return failure(result.error);
      }

      const sorted = sortReports(result.value.reports);
      const paginated = paginate(sorted, page, pageSize);

      return success({
        reports: paginated,
        totalCount: sorted.length,
        page,
        pageSize,
      });
    }

    // -- Logged-in viewer
    const viewerId = input.viewerId;

    const isSuperAdmin = await this.users.isSuperAdmin(viewerId);

    // Superadmin: single pass, everything
    if (isSuperAdmin) {
      const result = await this.reports.search({ includeArchived: false });

      if (!result.success) {
        return failure(result.error);
      }

      let all = dedup(result.value.reports);

      if (input.organizationIds && input.organizationIds.length > 0) {
        const orgSet = new Set(input.organizationIds);
        all = all.filter((r) => orgSet.has(r.organizationId));
      }

      const sorted = sortReports(all);
      const paginated = paginate(sorted, page, pageSize);

      return success({
        reports: paginated,
        totalCount: sorted.length,
        page,
        pageSize,
      });
    }

    // Collect viewer context once
    const [memberOrgs, adminOrgs, memberBoards] = await Promise.all([
      this.orgs.findMembershipsByUserId(viewerId),
      this.orgs.findAdminOrganizationsByUserId(viewerId),
      this.boards.findActiveBoardsByUserId(viewerId),
    ]);

    const memberOrgIds = memberOrgs.map((o) => o.id);
    const adminOrgIds = adminOrgs.map((o) => o.id);
    const memberBoardIds = memberBoards.map((b) => b.id);
    // Org ids that host at least one board the viewer is in
    const boardOrgIds = [...new Set(memberBoards.map((b) => b.organizationId))];

    const passes: Array<
      Promise<Result<{ reports: Report[]; totalCount: number }, string>>
    > = [];

    // Pass 1: public-anon + public-auth published
    passes.push(
      this.reports.search({
        visibilities: [
          ReportVisibility.PUBLIC_ANON,
          ReportVisibility.PUBLIC_AUTH,
        ],
        state: 'PUBLISHED',
        includeArchived: false,
      })
    );

    // Pass 2: within-org published (all within-org visibilities for member orgs)
    if (memberOrgIds.length > 0) {
      passes.push(
        this.reports.search({
          organizationIds: memberOrgIds,
          visibilities: [
            ReportVisibility.WITHIN_ORG_ONLY,
            ReportVisibility.WITHIN_ORG_ANCESTORS,
            ReportVisibility.WITHIN_ORG_DESCENDANTS,
            ReportVisibility.WITHIN_ORG_TREE,
          ],
          state: 'PUBLISHED',
          includeArchived: false,
        })
      );
    }

    // Pass 3: within-boards published (filter in-memory by actual board membership)
    if (boardOrgIds.length > 0) {
      passes.push(
        this.reports.search({
          organizationIds: boardOrgIds,
          visibilities: [ReportVisibility.WITHIN_BOARDS],
          state: 'PUBLISHED',
          includeArchived: false,
        })
      );
    }

    // Pass 4: own drafts
    passes.push(
      this.reports.search({
        authorId: viewerId,
        state: 'DRAFT',
        includeArchived: false,
      })
    );

    // Pass 5: admin-org drafts (any author)
    if (adminOrgIds.length > 0) {
      passes.push(
        this.reports.search({
          organizationIds: adminOrgIds,
          state: 'DRAFT',
          includeArchived: false,
        })
      );
    }

    const passResults = await Promise.all(passes);

    for (const r of passResults) {
      if (!r.success) {
        return failure(r.error);
      }
    }

    const allReports = passResults.flatMap((r) =>
      r.success ? r.value.reports : []
    );

    // For within-boards pass we need in-memory board-membership filter
    const memberBoardSet = new Set(memberBoardIds);
    const filtered = allReports.filter((r) => {
      if (r.visibility !== ReportVisibility.WITHIN_BOARDS) {
        return true;
      }

      // Keep only if viewer is a member of at least one of the report's boards
      return r.boardIds.some((b) => memberBoardSet.has(b));
    });

    let merged = dedup(filtered);

    // Apply optional organizationIds intersection
    if (input.organizationIds && input.organizationIds.length > 0) {
      const orgSet = new Set(input.organizationIds);
      merged = merged.filter((r) => orgSet.has(r.organizationId));
    }

    const sorted = sortReports(merged);
    const paginated = paginate(sorted, page, pageSize);

    return success({
      reports: paginated,
      totalCount: sorted.length,
      page,
      pageSize,
    });
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function dedup(reports: Report[]): Report[] {
  const seen = new Set<string>();
  const result: Report[] = [];

  for (const r of reports) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      result.push(r);
    }
  }

  return result;
}

/** Sort by lastPublishedAt desc (nulls last), then createdAt desc. */
function sortReports(reports: Report[]): Report[] {
  return [...reports].sort((a, b) => {
    const aTime = a.lastPublishedAt?.getTime() ?? null;
    const bTime = b.lastPublishedAt?.getTime() ?? null;

    if (aTime !== null && bTime !== null) {
      if (bTime !== aTime) {
        return bTime - aTime;
      }
    } else if (aTime !== null) {
      return -1; // a has a date, b does not → a comes first
    } else if (bTime !== null) {
      return 1; // b has a date, a does not → b comes first
    }

    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;

  return items.slice(start, start + pageSize);
}
