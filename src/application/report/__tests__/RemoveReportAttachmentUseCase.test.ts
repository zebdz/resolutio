import { describe, it, expect, beforeEach } from 'vitest';
import { RemoveReportAttachmentUseCase } from '../RemoveReportAttachmentUseCase';
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
    attachmentIds: ['att-1'],
    ...overrides,
  });

const ATT_META = {
  id: 'att-1',
  reportId: 'r1',
  fileName: 'photo.png',
  mimeType: 'image/png',
  sizeBytes: 100,
  createdAt: new Date(),
};

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

class FakeAttachmentRepo {
  metadata = new Map<string, typeof ATT_META>();
  deleted: string[] = [];

  async findById(id: string) {
    const m = this.metadata.get(id);

    return { success: true as const, value: m ?? null };
  }

  async deleteById(id: string) {
    this.deleted.push(id);

    return { success: true as const, value: undefined };
  }
}

describe('RemoveReportAttachmentUseCase', () => {
  let reports: FakeReports;
  let orgs: FakeOrgs;
  let users: FakeUsers;
  let attachments: FakeAttachmentRepo;
  let uc: RemoveReportAttachmentUseCase;

  beforeEach(() => {
    reports = new FakeReports();
    orgs = new FakeOrgs();
    users = new FakeUsers();
    attachments = new FakeAttachmentRepo();
    uc = new RemoveReportAttachmentUseCase(
      reports as any,
      orgs as any,
      users as any,
      attachments as any
    );
    reports.store.set('r1', makeReport());
    attachments.metadata.set('att-1', ATT_META);
  });

  it('author removes an attachment from Draft', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      attachmentId: 'att-1',
    });
    expect(r.success).toBe(true);
    expect(attachments.deleted).toContain('att-1');
    expect(reports.updated[0].attachmentIds).not.toContain('att-1');
  });

  it('admin removes an attachment from Draft', async () => {
    orgs.admins.add('admin-1:org-1');
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'admin-1',
      attachmentId: 'att-1',
    });
    expect(r.success).toBe(true);
    expect(attachments.deleted).toContain('att-1');
  });

  it('non-author non-admin rejected with NOT_AUTHOR_OR_ADMIN', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'random',
      attachmentId: 'att-1',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.NOT_AUTHOR_OR_ADMIN);
    }
  });

  it('published report rejected via aggregate detachAttachment', async () => {
    reports.store.set(
      'r1',
      makeReport({ state: 'PUBLISHED', attachmentIds: ['att-1'] })
    );
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      attachmentId: 'att-1',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }
  });

  it('missing attachment returns ATTACHMENT_NOT_FOUND', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      attachmentId: 'no-such',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.ATTACHMENT_NOT_FOUND);
    }
  });

  it('attachment belonging to different report returns ATTACHMENT_NOT_FOUND', async () => {
    attachments.metadata.set('att-1', { ...ATT_META, reportId: 'r-other' });
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      attachmentId: 'att-1',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.ATTACHMENT_NOT_FOUND);
    }
  });
});
