import { describe, it, expect, beforeEach } from 'vitest';
import { AddReportAttachmentUseCase } from '../AddReportAttachmentUseCase';
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

// Minimal valid PNG bytes (8-byte magic)
const PNG_MAGIC = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

// Truncated JPEG magic
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00]);

// Bytes that look like executable (invalid for any allowed mime)
const INVALID_MAGIC = Buffer.from([0x4d, 0x5a, 0x00, 0x00]); // MZ header

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
  count = 0;
  saved: Array<{ id: string }> = [];

  async countByReportId(_reportId: string) {
    return { success: true as const, value: this.count };
  }

  async save(_att: unknown, _bytes: Buffer) {
    const id = `att-${this.saved.length + 1}`;
    this.saved.push({ id });

    return {
      success: true as const,
      value: {
        id,
        reportId: 'r1',
        fileName: 'f.png',
        mimeType: 'image/png',
        sizeBytes: 12,
        createdAt: new Date(),
      },
    };
  }
}

describe('AddReportAttachmentUseCase', () => {
  let reports: FakeReports;
  let orgs: FakeOrgs;
  let users: FakeUsers;
  let attachments: FakeAttachmentRepo;
  let uc: AddReportAttachmentUseCase;

  beforeEach(() => {
    reports = new FakeReports();
    orgs = new FakeOrgs();
    users = new FakeUsers();
    attachments = new FakeAttachmentRepo();
    uc = new AddReportAttachmentUseCase(
      reports as any,
      orgs as any,
      users as any,
      attachments as any
    );
    reports.store.set('r1', makeReport());
  });

  it('author uploads a valid PNG', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      fileName: 'photo.png',
      mimeType: 'image/png',
      bytes: PNG_MAGIC,
    });
    expect(r.success).toBe(true);
    const result = unwrap(r);
    expect(result.id).toBe('att-1');
    expect(reports.updated[0].attachmentIds).toContain('att-1');
  });

  it('admin uploads a valid PNG', async () => {
    orgs.admins.add('admin-1:org-1');
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'admin-1',
      fileName: 'photo.png',
      mimeType: 'image/png',
      bytes: PNG_MAGIC,
    });
    expect(r.success).toBe(true);
  });

  it('non-author non-admin rejected with NOT_AUTHOR_OR_ADMIN', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'random',
      fileName: 'photo.png',
      mimeType: 'image/png',
      bytes: PNG_MAGIC,
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.NOT_AUTHOR_OR_ADMIN);
    }
  });

  it('rejects when attachment count is at limit (20)', async () => {
    attachments.count = 20;
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      fileName: 'photo.png',
      mimeType: 'image/png',
      bytes: PNG_MAGIC,
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_ATTACHMENT_LIMIT_REACHED);
    }
  });

  it('rejects invalid mime type', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      fileName: 'file.exe',
      mimeType: 'application/octet-stream',
      bytes: INVALID_MAGIC,
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(
        ReportDomainCodes.REPORT_ATTACHMENT_TYPE_NOT_ALLOWED
      );
    }
  });

  it('rejects magic byte mismatch (PNG mime but JPEG bytes)', async () => {
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      fileName: 'photo.png',
      mimeType: 'image/png',
      bytes: JPEG_MAGIC,
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_ATTACHMENT_MAGIC_MISMATCH);
    }
  });

  it('published report rejected via aggregate attachAttachment', async () => {
    reports.store.set('r1', makeReport({ state: 'PUBLISHED' }));
    const r = await uc.execute({
      reportId: 'r1',
      callerId: 'author-1',
      fileName: 'photo.png',
      mimeType: 'image/png',
      bytes: PNG_MAGIC,
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
      fileName: 'photo.png',
      mimeType: 'image/png',
      bytes: PNG_MAGIC,
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.REPORT_NOT_FOUND);
    }
  });
});
