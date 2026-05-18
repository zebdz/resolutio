import { describe, it, expect, beforeEach } from 'vitest';
import { DowngradeReportToDraftUseCase } from '../DowngradeReportToDraftUseCase';
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
    state: 'PUBLISHED',
    publishedById: 'admin-1',
    lastPublishedAt: new Date(),
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

describe('DowngradeReportToDraftUseCase', () => {
  let reports: FakeReports;
  let orgs: FakeOrgs;
  let users: FakeUsers;
  let uc: DowngradeReportToDraftUseCase;

  beforeEach(() => {
    reports = new FakeReports();
    orgs = new FakeOrgs();
    users = new FakeUsers();
    uc = new DowngradeReportToDraftUseCase(
      reports as any,
      orgs as any,
      users as any
    );
    reports.store.set('r1', makeReport());
  });

  it('author downgrades Published → Draft', async () => {
    const r = await uc.execute({ reportId: 'r1', callerId: 'author-1' });
    expect(r.success).toBe(true);
    expect(reports.updated[0].state).toBe('DRAFT');
  });

  it('admin downgrades Published → Draft', async () => {
    orgs.admins.add('admin-1:org-1');
    const r = await uc.execute({ reportId: 'r1', callerId: 'admin-1' });
    expect(r.success).toBe(true);
    expect(reports.updated[0].state).toBe('DRAFT');
  });

  it('superadmin downgrades Published → Draft', async () => {
    users.superadmins.add('super-1');
    const r = await uc.execute({ reportId: 'r1', callerId: 'super-1' });
    expect(r.success).toBe(true);
    expect(reports.updated[0].state).toBe('DRAFT');
  });

  it('non-author non-admin rejected with NOT_AUTHOR_OR_ADMIN', async () => {
    const r = await uc.execute({ reportId: 'r1', callerId: 'random-user' });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.NOT_AUTHOR_OR_ADMIN);
    }
  });

  it('downgrading a Draft report rejected (domain REPORT_MUST_BE_PUBLISHED)', async () => {
    reports.store.set(
      'r1',
      makeReport({ state: 'DRAFT', publishedById: null, lastPublishedAt: null })
    );
    const r = await uc.execute({ reportId: 'r1', callerId: 'author-1' });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_MUST_BE_PUBLISHED);
    }
  });

  it('returns REPORT_NOT_FOUND when report missing', async () => {
    reports.store.clear();
    const r = await uc.execute({ reportId: 'r1', callerId: 'author-1' });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.REPORT_NOT_FOUND);
    }
  });
});
