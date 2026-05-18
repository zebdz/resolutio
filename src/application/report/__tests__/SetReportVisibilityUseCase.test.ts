import { describe, it, expect, beforeEach } from 'vitest';
import { SetReportVisibilityUseCase } from '../SetReportVisibilityUseCase';
import { Report, ReportProps } from '../../../domain/report/Report';
import { ReportVisibility } from '../../../domain/report/ReportVisibility';
import { ReportErrors } from '../ReportErrors';
import { ReportDomainCodes } from '../../../domain/report/ReportDomainCodes';

function unwrap<T>(
  r: { success: true; value: T } | { success: false; error: string }
): T {
  if (!r.success) {
    throw new Error(`Expected success, got: ${r.error}`);
  }

  return r.value;
}

const makeReport = (overrides: Partial<ReportProps> = {}) =>
  Report.reconstitute({
    id: 'r1',
    organizationId: 'org-1',
    createdById: 'author-1',
    title: 't',
    body: 'b',
    visibility: ReportVisibility.WITHIN_ORG_ONLY,
    state: 'DRAFT',
    publishedById: null,
    lastPublishedAt: null,
    notifyAudience: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    boardIds: [],
    pollIds: [],
    attachmentIds: [],
    ...overrides,
  });

class FakeReports {
  store = new Map<string, Report>();
  updated: Report[] = [];
  async findByIdWithRelations(id: string) {
    const r = this.store.get(id);

    return { success: true as const, value: r ?? null };
  }
  async update(r: Report) {
    this.updated.push(r);

    return { success: true as const, value: undefined };
  }
}

class FakeOrgs {
  admins = new Set<string>(); // `${userId}:${orgId}`
  async isUserAdmin(userId: string, orgId: string) {
    return this.admins.has(`${userId}:${orgId}`);
  }
}

class FakeUsers {
  superadmins = new Set<string>();
  async isSuperAdmin(userId: string) {
    return this.superadmins.has(userId);
  }
}

class FakeBoards {
  byOrg = new Map<string, string[]>(); // orgId -> boardIds
  async findByOrganizationId(orgId: string) {
    const ids = this.byOrg.get(orgId) ?? [];

    return ids.map((id) => ({ id }));
  }
}

describe('SetReportVisibilityUseCase', () => {
  let reports: FakeReports;
  let orgs: FakeOrgs;
  let users: FakeUsers;
  let boards: FakeBoards;
  let uc: SetReportVisibilityUseCase;

  beforeEach(() => {
    reports = new FakeReports();
    orgs = new FakeOrgs();
    users = new FakeUsers();
    boards = new FakeBoards();
    uc = new SetReportVisibilityUseCase(
      reports as any,
      orgs as any,
      users as any,
      boards as any
    );
    reports.store.set('r1', makeReport());
  });

  it('author can set visibility on Draft', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      visibility: ReportVisibility.PUBLIC_ANON,
      boardIds: [],
    });
    expect(r.success).toBe(true);
    expect(reports.updated[0].visibility).toBe(ReportVisibility.PUBLIC_ANON);
  });

  it('admin can set visibility on Draft', async () => {
    orgs.admins.add('admin-1:org-1');
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'admin-1',
      visibility: ReportVisibility.PUBLIC_AUTH,
      boardIds: [],
    });
    expect(r.success).toBe(true);
    expect(reports.updated[0].visibility).toBe(ReportVisibility.PUBLIC_AUTH);
  });

  it('non-author non-admin rejected with NOT_AUTHOR_OR_ADMIN', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'random',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      boardIds: [],
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.NOT_AUTHOR_OR_ADMIN);
    }
  });

  it('WITHIN_BOARDS with non-org board rejected with REPORT_BOARD_NOT_IN_ORG', async () => {
    boards.byOrg.set('org-1', ['b1']);
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      visibility: ReportVisibility.WITHIN_BOARDS,
      boardIds: ['b1', 'foreign-board'],
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_BOARD_NOT_IN_ORG);
    }
  });

  it('cannot set visibility on Published report', async () => {
    const published = makeReport({ state: 'PUBLISHED' });
    reports.store.set('r1', published);
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      boardIds: [],
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }
  });

  it('returns REPORT_NOT_FOUND when report missing', async () => {
    reports.store.clear();
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      boardIds: [],
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.REPORT_NOT_FOUND);
    }
  });
});
