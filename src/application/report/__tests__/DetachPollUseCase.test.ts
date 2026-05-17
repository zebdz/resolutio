import { describe, it, expect, beforeEach } from 'vitest';
import { DetachPollUseCase } from '../DetachPollUseCase';
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
    pollIds: ['poll-1'],
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
  admins = new Set<string>();
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

describe('DetachPollUseCase', () => {
  let reports: FakeReports;
  let orgs: FakeOrgs;
  let users: FakeUsers;
  let uc: DetachPollUseCase;

  beforeEach(() => {
    reports = new FakeReports();
    orgs = new FakeOrgs();
    users = new FakeUsers();
    uc = new DetachPollUseCase(reports as any, orgs as any, users as any);
    reports.store.set('r1', makeReport());
  });

  it('author detaches a poll from Draft', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      pollId: 'poll-1',
    });
    expect(r.success).toBe(true);
    expect(reports.updated[0].pollIds).not.toContain('poll-1');
  });

  it('admin detaches a poll from Draft', async () => {
    orgs.admins.add('admin-1:org-1');
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'admin-1',
      pollId: 'poll-1',
    });
    expect(r.success).toBe(true);
    expect(reports.updated[0].pollIds).not.toContain('poll-1');
  });

  it('non-author non-admin rejected with NOT_AUTHOR_OR_ADMIN', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'random',
      pollId: 'poll-1',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.NOT_AUTHOR_OR_ADMIN);
    }
  });

  it('published report rejected via domain with REPORT_CANNOT_EDIT_PUBLISHED', async () => {
    reports.store.set(
      'r1',
      makeReport({ state: 'PUBLISHED', pollIds: ['poll-1'] })
    );
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      pollId: 'poll-1',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }
  });

  it('report not found returns REPORT_NOT_FOUND', async () => {
    reports.store.clear();
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      pollId: 'poll-1',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.REPORT_NOT_FOUND);
    }
  });
});
