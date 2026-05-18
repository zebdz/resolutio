import { describe, it, expect, beforeEach } from 'vitest';
import { PublishReportUseCase } from '../PublishReportUseCase';
import { Report, ReportProps } from '../../../domain/report/Report';
import { ReportVisibility } from '../../../domain/report/ReportVisibility';
import { ReportErrors } from '../ReportErrors';

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

class FakeNotify {
  calls: Report[] = [];
  async notifyPublished(report: Report) {
    this.calls.push(report);
  }
}

describe('PublishReportUseCase', () => {
  let reports: FakeReports;
  let orgs: FakeOrgs;
  let users: FakeUsers;
  let notify: FakeNotify;
  let uc: PublishReportUseCase;

  beforeEach(() => {
    reports = new FakeReports();
    orgs = new FakeOrgs();
    users = new FakeUsers();
    notify = new FakeNotify();
    uc = new PublishReportUseCase(
      reports as any,
      orgs as any,
      users as any,
      notify
    );
    reports.store.set('r1', makeReport());
  });

  it('admin publishes Draft → state becomes PUBLISHED; notify NOT called when notifyAudience=false', async () => {
    orgs.admins.add('admin-1:org-1');
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'admin-1',
      notifyAudience: false,
    });
    expect(r.success).toBe(true);
    expect(reports.updated[0].state).toBe('PUBLISHED');
    expect(notify.calls).toHaveLength(0);
  });

  it('admin publishes with notifyAudience=true and WITHIN_ORG_ONLY → notify called once', async () => {
    orgs.admins.add('admin-1:org-1');
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'admin-1',
      notifyAudience: true,
    });
    expect(r.success).toBe(true);
    expect(notify.calls).toHaveLength(1);
  });

  it('superadmin can publish', async () => {
    users.superadmins.add('super-1');
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'super-1',
      notifyAudience: false,
    });
    expect(r.success).toBe(true);
    expect(reports.updated[0].state).toBe('PUBLISHED');
  });

  it('non-admin author rejected with NOT_ORG_ADMIN', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      notifyAudience: false,
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.NOT_ORG_ADMIN);
    }
  });

  it('non-admin non-author rejected with NOT_ORG_ADMIN', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'random-user',
      notifyAudience: false,
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.NOT_ORG_ADMIN);
    }
  });

  it('public-anon report with notifyAudience=true → publish succeeds, domain clears notifyAudience, notify NOT called', async () => {
    reports.store.set(
      'r1',
      makeReport({ visibility: ReportVisibility.PUBLIC_ANON })
    );
    orgs.admins.add('admin-1:org-1');
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'admin-1',
      notifyAudience: true,
    });
    expect(r.success).toBe(true);
    expect(reports.updated[0].notifyAudience).toBe(false);
    expect(notify.calls).toHaveLength(0);
  });

  it('returns REPORT_NOT_FOUND when report missing', async () => {
    reports.store.clear();
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'admin-1',
      notifyAudience: false,
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.REPORT_NOT_FOUND);
    }
  });

  it('notify throwing does NOT fail the publish — use case returns success', async () => {
    const throwingNotify = {
      async notifyPublished(_report: Report) {
        throw new Error('notification service down');
      },
    };
    uc = new PublishReportUseCase(
      reports as any,
      orgs as any,
      users as any,
      throwingNotify
    );
    orgs.admins.add('admin-1:org-1');
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'admin-1',
      notifyAudience: true,
    });
    expect(r.success).toBe(true);
  });
});
