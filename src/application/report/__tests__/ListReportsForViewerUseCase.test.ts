import { describe, it, expect, beforeEach } from 'vitest';
import { ListReportsForViewerUseCase } from '../ListReportsForViewerUseCase';
import { Report, ReportProps } from '../../../domain/report/Report';
import { ReportVisibility } from '../../../domain/report/ReportVisibility';
import { success } from '../../../domain/shared/Result';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let reportIdSeq = 0;

const makeReport = (overrides: Partial<ReportProps> = {}): Report => {
  reportIdSeq++;

  return Report.reconstitute({
    id: `r${reportIdSeq}`,
    organizationId: 'org-1',
    createdById: 'author-1',
    title: `Report ${reportIdSeq}`,
    body: 'body',
    visibility: ReportVisibility.PUBLIC_ANON,
    state: 'PUBLISHED',
    publishedById: 'author-1',
    lastPublishedAt: new Date(`2025-0${(reportIdSeq % 9) + 1}-01`),
    notifyAudience: false,
    createdAt: new Date(`2025-0${(reportIdSeq % 9) + 1}-01`),
    updatedAt: new Date(`2025-0${(reportIdSeq % 9) + 1}-01`),
    archivedAt: null,
    boardIds: [],
    pollIds: [],
    attachmentIds: [],
    ...overrides,
  });
};

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakeReportRepo {
  private store: Report[] = [];

  seed(report: Report) {
    this.store.push(report);
  }

  async search(filters: {
    organizationIds?: string[];
    visibilities?: string[];
    state?: string;
    includeArchived?: boolean;
    authorId?: string;
    page?: number;
    pageSize?: number;
  }) {
    let results = [...this.store];

    if (filters.organizationIds && filters.organizationIds.length > 0) {
      results = results.filter((r) =>
        filters.organizationIds!.includes(r.organizationId)
      );
    }

    if (filters.visibilities && filters.visibilities.length > 0) {
      results = results.filter((r) =>
        filters.visibilities!.includes(r.visibility)
      );
    }

    if (filters.state) {
      results = results.filter((r) => r.state === filters.state);
    }

    if (!filters.includeArchived) {
      results = results.filter((r) => !r.isArchived());
    }

    if (filters.authorId) {
      results = results.filter((r) => r.createdById === filters.authorId);
    }

    return success({ reports: results, totalCount: results.length });
  }
}

class FakeOrgRepo {
  memberships = new Map<string, string[]>(); // userId -> orgIds
  adminships = new Map<string, string[]>(); // userId -> orgIds

  seedMember(userId: string, orgId: string) {
    const ids = this.memberships.get(userId) ?? [];
    ids.push(orgId);
    this.memberships.set(userId, ids);
  }

  seedAdmin(userId: string, orgId: string) {
    const ids = this.adminships.get(userId) ?? [];
    ids.push(orgId);
    this.adminships.set(userId, ids);
  }

  async findMembershipsByUserId(userId: string) {
    const orgIds = this.memberships.get(userId) ?? [];

    return orgIds.map((id) => ({ id }) as any);
  }

  async findAdminOrganizationsByUserId(userId: string) {
    const orgIds = this.adminships.get(userId) ?? [];

    return orgIds.map((id) => ({ id }) as any);
  }
}

class FakeBoardRepo {
  boards = new Map<
    string,
    Array<{ id: string; name: string; organizationId: string }>
  >();

  seedBoard(
    userId: string,
    board: { id: string; name: string; organizationId: string }
  ) {
    const existing = this.boards.get(userId) ?? [];
    existing.push(board);
    this.boards.set(userId, existing);
  }

  async findActiveBoardsByUserId(userId: string) {
    return this.boards.get(userId) ?? [];
  }
}

class FakeUserRepo {
  superadmins = new Set<string>();

  async isSuperAdmin(userId: string) {
    return this.superadmins.has(userId);
  }
}

function makeUseCase(
  reportRepo: FakeReportRepo,
  orgRepo: FakeOrgRepo,
  boardRepo: FakeBoardRepo,
  userRepo: FakeUserRepo
) {
  return new ListReportsForViewerUseCase(
    reportRepo as any,
    orgRepo as any,
    boardRepo as any,
    userRepo as any
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ListReportsForViewerUseCase', () => {
  let reportRepo: FakeReportRepo;
  let orgRepo: FakeOrgRepo;
  let boardRepo: FakeBoardRepo;
  let userRepo: FakeUserRepo;
  let uc: ListReportsForViewerUseCase;

  beforeEach(() => {
    reportIdSeq = 0;
    reportRepo = new FakeReportRepo();
    orgRepo = new FakeOrgRepo();
    boardRepo = new FakeBoardRepo();
    userRepo = new FakeUserRepo();
    uc = makeUseCase(reportRepo, orgRepo, boardRepo, userRepo);
  });

  // -------------------------------------------------------------------------
  // Anonymous viewer
  // -------------------------------------------------------------------------

  it('anonymous viewer sees only published public-anon reports', async () => {
    const publicAnon = makeReport({
      visibility: ReportVisibility.PUBLIC_ANON,
      state: 'PUBLISHED',
    });
    const publicAuth = makeReport({
      visibility: ReportVisibility.PUBLIC_AUTH,
      state: 'PUBLISHED',
    });
    const withinOrg = makeReport({
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      state: 'PUBLISHED',
    });

    reportRepo.seed(publicAnon);
    reportRepo.seed(publicAuth);
    reportRepo.seed(withinOrg);

    const result = await uc.execute({ viewerId: null });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.value.reports).toHaveLength(1);
    expect(result.value.reports[0].visibility).toBe(
      ReportVisibility.PUBLIC_ANON
    );
  });

  // -------------------------------------------------------------------------
  // Logged-in viewer
  // -------------------------------------------------------------------------

  it('logged-in viewer sees public-anon, public-auth, and own org within-org reports', async () => {
    orgRepo.seedMember('u1', 'org-1');

    const publicAnon = makeReport({
      visibility: ReportVisibility.PUBLIC_ANON,
      state: 'PUBLISHED',
    });
    const publicAuth = makeReport({
      visibility: ReportVisibility.PUBLIC_AUTH,
      state: 'PUBLISHED',
    });
    const withinOrg = makeReport({
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      state: 'PUBLISHED',
      organizationId: 'org-1',
    });
    const withinOtherOrg = makeReport({
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      state: 'PUBLISHED',
      organizationId: 'org-2',
    });

    reportRepo.seed(publicAnon);
    reportRepo.seed(publicAuth);
    reportRepo.seed(withinOrg);
    reportRepo.seed(withinOtherOrg);

    const result = await uc.execute({ viewerId: 'u1' });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    const ids = result.value.reports.map((r) => r.id);
    expect(ids).toContain(publicAnon.id);
    expect(ids).toContain(publicAuth.id);
    expect(ids).toContain(withinOrg.id);
    expect(ids).not.toContain(withinOtherOrg.id);
  });

  // -------------------------------------------------------------------------
  // Within-boards
  // -------------------------------------------------------------------------

  it('within-boards: viewer sees reports for boards they belong to, not others', async () => {
    orgRepo.seedMember('u1', 'org-1');
    boardRepo.seedBoard('u1', {
      id: 'board-A',
      name: 'Board A',
      organizationId: 'org-1',
    });

    const reportForBoardA = makeReport({
      visibility: ReportVisibility.WITHIN_BOARDS,
      state: 'PUBLISHED',
      boardIds: ['board-A'],
      organizationId: 'org-1',
    });
    const reportForBoardB = makeReport({
      visibility: ReportVisibility.WITHIN_BOARDS,
      state: 'PUBLISHED',
      boardIds: ['board-B'],
      organizationId: 'org-1',
    });

    reportRepo.seed(reportForBoardA);
    reportRepo.seed(reportForBoardB);

    const result = await uc.execute({ viewerId: 'u1' });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    const ids = result.value.reports.map((r) => r.id);
    expect(ids).toContain(reportForBoardA.id);
    expect(ids).not.toContain(reportForBoardB.id);
  });

  // -------------------------------------------------------------------------
  // Drafts
  // -------------------------------------------------------------------------

  it('author sees own drafts', async () => {
    orgRepo.seedMember('u1', 'org-1');

    const ownDraft = makeReport({
      state: 'DRAFT',
      createdById: 'u1',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      organizationId: 'org-1',
    });
    const otherDraft = makeReport({
      state: 'DRAFT',
      createdById: 'other-author',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      organizationId: 'org-1',
    });

    reportRepo.seed(ownDraft);
    reportRepo.seed(otherDraft);

    const result = await uc.execute({ viewerId: 'u1' });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    const ids = result.value.reports.map((r) => r.id);
    expect(ids).toContain(ownDraft.id);
    expect(ids).not.toContain(otherDraft.id);
  });

  it('admin sees drafts in orgs they admin', async () => {
    orgRepo.seedAdmin('admin-1', 'org-1');

    const draftInAdminOrg = makeReport({
      state: 'DRAFT',
      createdById: 'some-author',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      organizationId: 'org-1',
    });
    const draftInOtherOrg = makeReport({
      state: 'DRAFT',
      createdById: 'some-author',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      organizationId: 'org-2',
    });

    reportRepo.seed(draftInAdminOrg);
    reportRepo.seed(draftInOtherOrg);

    const result = await uc.execute({ viewerId: 'admin-1' });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    const ids = result.value.reports.map((r) => r.id);
    expect(ids).toContain(draftInAdminOrg.id);
    expect(ids).not.toContain(draftInOtherOrg.id);
  });

  it('non-admin non-author does not see others drafts', async () => {
    orgRepo.seedMember('u1', 'org-1');

    const otherDraft = makeReport({
      state: 'DRAFT',
      createdById: 'other-author',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      organizationId: 'org-1',
    });

    reportRepo.seed(otherDraft);

    const result = await uc.execute({ viewerId: 'u1' });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.value.reports).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Superadmin
  // -------------------------------------------------------------------------

  it('superadmin sees all reports across orgs, visibilities, and states', async () => {
    userRepo.superadmins.add('su');

    const r1 = makeReport({
      visibility: ReportVisibility.PUBLIC_ANON,
      state: 'PUBLISHED',
    });
    const r2 = makeReport({
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      state: 'DRAFT',
      organizationId: 'org-99',
    });
    const r3 = makeReport({
      visibility: ReportVisibility.WITHIN_BOARDS,
      state: 'PUBLISHED',
      boardIds: ['secret-board'],
    });

    reportRepo.seed(r1);
    reportRepo.seed(r2);
    reportRepo.seed(r3);

    const result = await uc.execute({ viewerId: 'su' });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    const ids = result.value.reports.map((r) => r.id);
    expect(ids).toContain(r1.id);
    expect(ids).toContain(r2.id);
    expect(ids).toContain(r3.id);
  });

  // -------------------------------------------------------------------------
  // organizationIds intersection filter
  // -------------------------------------------------------------------------

  it('organizationIds filter intersects the accessible set', async () => {
    const r1 = makeReport({
      visibility: ReportVisibility.PUBLIC_ANON,
      state: 'PUBLISHED',
      organizationId: 'org-1',
    });
    const r2 = makeReport({
      visibility: ReportVisibility.PUBLIC_ANON,
      state: 'PUBLISHED',
      organizationId: 'org-2',
    });

    reportRepo.seed(r1);
    reportRepo.seed(r2);

    const result = await uc.execute({
      viewerId: null,
      organizationIds: ['org-1'],
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.value.reports).toHaveLength(1);
    expect(result.value.reports[0].organizationId).toBe('org-1');
  });

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  it('pagination: page 2 of pageSize 1 returns 1 row', async () => {
    const r1 = makeReport({
      visibility: ReportVisibility.PUBLIC_ANON,
      state: 'PUBLISHED',
      lastPublishedAt: new Date('2025-01-01'),
    });
    const r2 = makeReport({
      visibility: ReportVisibility.PUBLIC_ANON,
      state: 'PUBLISHED',
      lastPublishedAt: new Date('2025-02-01'),
    });

    reportRepo.seed(r1);
    reportRepo.seed(r2);

    const result = await uc.execute({ viewerId: null, page: 2, pageSize: 1 });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.value.reports).toHaveLength(1);
    expect(result.value.page).toBe(2);
    expect(result.value.pageSize).toBe(1);
    expect(result.value.totalCount).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Sort
  // -------------------------------------------------------------------------

  it('sort: most recently published first', async () => {
    const older = makeReport({
      visibility: ReportVisibility.PUBLIC_ANON,
      state: 'PUBLISHED',
      lastPublishedAt: new Date('2025-01-01'),
    });
    const newer = makeReport({
      visibility: ReportVisibility.PUBLIC_ANON,
      state: 'PUBLISHED',
      lastPublishedAt: new Date('2025-06-01'),
    });

    // Seed older first to verify sort is not insertion-order
    reportRepo.seed(older);
    reportRepo.seed(newer);

    const result = await uc.execute({ viewerId: null });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.value.reports[0].id).toBe(newer.id);
    expect(result.value.reports[1].id).toBe(older.id);
  });
});
