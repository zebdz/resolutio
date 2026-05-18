import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateReportUseCase } from '../UpdateReportUseCase';
import { Report, ReportProps } from '../../../domain/report/Report';
import { ReportVisibility } from '../../../domain/report/ReportVisibility';
import { ReportErrors } from '../ReportErrors';
import { ReportDomainCodes } from '../../../domain/report/ReportDomainCodes';

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
  updated: Array<{ id: string; title: string; body: string }> = [];
  async findByIdWithRelations(id: string) {
    const r = this.store.get(id);

    return { success: true as const, value: r ?? null };
  }
  async update(r: Report) {
    this.updated.push({ id: r.id, title: r.title, body: r.body });

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

describe('UpdateReportUseCase', () => {
  let reports: FakeReports;
  let orgs: FakeOrgs;
  let users: FakeUsers;
  let uc: UpdateReportUseCase;

  beforeEach(() => {
    reports = new FakeReports();
    orgs = new FakeOrgs();
    users = new FakeUsers();

    uc = new UpdateReportUseCase(reports as any, orgs as any, users as any);
    reports.store.set('r1', makeReport());
  });

  it('author can update Draft title and body', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      title: 'New T',
      body: 'New B',
    });
    expect(r.success).toBe(true);
    expect(reports.updated[0]).toMatchObject({ title: 'New T', body: 'New B' });
  });

  it('org admin can update Draft', async () => {
    orgs.admins.add('admin-1:org-1');
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'admin-1',
      title: 'New T',
      body: 'New B',
    });
    expect(r.success).toBe(true);
  });

  it('superadmin can update Draft', async () => {
    users.superadmins.add('su');
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'su',
      title: 'New T',
      body: 'New B',
    });
    expect(r.success).toBe(true);
  });

  it('non-author non-admin rejected', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'random',
      title: 'New T',
      body: 'New B',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.NOT_AUTHOR_OR_ADMIN);
    }
  });

  it('cannot update Published report', async () => {
    const r = makeReport();
    r.publish('admin-1', false);
    reports.store.set('r1', r);
    const out = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      title: 'X',
      body: 'Y',
    });
    expect(out.success).toBe(false);

    if (!out.success) {
      expect(out.error).toBe(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }
  });

  it('returns REPORT_NOT_FOUND when report missing', async () => {
    reports.store.clear();
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      title: 'X',
      body: 'Y',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.REPORT_NOT_FOUND);
    }
  });
});
