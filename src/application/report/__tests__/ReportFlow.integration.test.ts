import { describe, it, expect, beforeEach } from 'vitest';
import { CreateReportUseCase } from '../CreateReportUseCase';
import { PublishReportUseCase } from '../PublishReportUseCase';
import { DowngradeReportToDraftUseCase } from '../DowngradeReportToDraftUseCase';
import { ArchiveReportUseCase } from '../ArchiveReportUseCase';
import { Report } from '../../../domain/report/Report';
import { ReportVisibility } from '../../../domain/report/ReportVisibility';
import { ReportErrors } from '../ReportErrors';

class InMemoryReports {
  store = new Map<string, Report>();
  async create(r: Report) {
    this.store.set(r.id, r);

    return { success: true as const, value: r };
  }
  async update(r: Report) {
    this.store.set(r.id, r);

    return { success: true as const, value: undefined };
  }
  async findById(id: string) {
    return { success: true as const, value: this.store.get(id) ?? null };
  }
  async findByIdWithRelations(id: string) {
    return { success: true as const, value: this.store.get(id) ?? null };
  }
  async listPublicAnonForSitemap() {
    return { success: true as const, value: [] };
  }
  async search() {
    return {
      success: true as const,
      value: { reports: [], totalCount: 0 },
    };
  }
}

class InMemoryOrgs {
  members = new Set<string>();
  admins = new Set<string>();
  async isUserExactMember(userId: string, orgId: string) {
    return this.members.has(`${userId}:${orgId}`);
  }
  async isUserAdmin(userId: string, orgId: string) {
    return this.admins.has(`${userId}:${orgId}`);
  }
}

class InMemoryBoards {
  async findByOrganizationId(_orgId: string) {
    return [];
  }
}

class InMemoryUsers {
  superadmins = new Set<string>();
  async isSuperAdmin(userId: string) {
    return this.superadmins.has(userId);
  }
}

class NoopNotify {
  async notifyPublished(_r: Report) {}
}

describe('Report flow integration smoke test', () => {
  let reports: InMemoryReports;
  let orgs: InMemoryOrgs;
  let boards: InMemoryBoards;
  let users: InMemoryUsers;
  let createUC: CreateReportUseCase;
  let publishUC: PublishReportUseCase;
  let downgradeUC: DowngradeReportToDraftUseCase;
  let archiveUC: ArchiveReportUseCase;

  const author = 'user-author';
  const admin = 'user-admin';
  const orgId = 'org-1';

  beforeEach(() => {
    reports = new InMemoryReports();
    orgs = new InMemoryOrgs();
    boards = new InMemoryBoards();
    users = new InMemoryUsers();

    orgs.members.add(`${author}:${orgId}`);
    orgs.members.add(`${admin}:${orgId}`);
    orgs.admins.add(`${admin}:${orgId}`);

    createUC = new CreateReportUseCase(reports as any, orgs, boards);
    publishUC = new PublishReportUseCase(
      reports as any,
      orgs,
      users,
      new NoopNotify()
    );
    downgradeUC = new DowngradeReportToDraftUseCase(
      reports as any,
      orgs,
      users
    );
    archiveUC = new ArchiveReportUseCase(reports as any, orgs, users);
  });

  it('full state machine: create → publish → downgrade → republish → archive', async () => {
    // 1. Member creates report → Draft
    const created = await createUC.execute({
      userId: author,
      organizationId: orgId,
      title: 'My Report',
      body: 'Hello world',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      boardIds: [],
    });
    expect(created.success).toBe(true);

    if (!created.success) {
      return;
    }

    const reportId = created.value.id;
    expect(created.value.state).toBe('DRAFT');
    expect(created.value.lastPublishedAt).toBeNull();
    expect(created.value.publishedById).toBeNull();

    // 2. Admin publishes → Published with lastPublishedAt
    const published = await publishUC.execute({
      reportId,
      callerId: admin,
      notifyAudience: false,
    });
    expect(published.success).toBe(true);

    const afterPublish = (await reports.findById(reportId)).value!;
    expect(afterPublish.state).toBe('PUBLISHED');
    expect(afterPublish.publishedById).toBe(admin);
    expect(afterPublish.lastPublishedAt).toBeInstanceOf(Date);

    const firstPublishedAt = afterPublish.lastPublishedAt!;

    // 3. Admin downgrades → Draft, lastPublishedAt preserved
    const downgraded = await downgradeUC.execute({
      reportId,
      callerId: admin,
    });
    expect(downgraded.success).toBe(true);

    const afterDowngrade = (await reports.findById(reportId)).value!;
    expect(afterDowngrade.state).toBe('DRAFT');
    expect(afterDowngrade.publishedById).toBeNull();
    expect(afterDowngrade.lastPublishedAt).toEqual(firstPublishedAt);

    // 4. Admin republishes → Published with updated lastPublishedAt
    await new Promise((r) => setTimeout(r, 5));
    const republished = await publishUC.execute({
      reportId,
      callerId: admin,
      notifyAudience: false,
    });
    expect(republished.success).toBe(true);

    const afterRepublish = (await reports.findById(reportId)).value!;
    expect(afterRepublish.state).toBe('PUBLISHED');
    expect(afterRepublish.lastPublishedAt!.getTime()).toBeGreaterThan(
      firstPublishedAt.getTime()
    );

    // 5. Archive succeeds; subsequent publish blocked
    const archived = await archiveUC.execute({ reportId, callerId: admin });
    expect(archived.success).toBe(true);

    const afterArchive = (await reports.findById(reportId)).value!;
    expect(afterArchive.archivedAt).toBeInstanceOf(Date);

    // Note: archive doesn't downgrade state, but new publish should fail.
    // Downgrade first to ensure the publish path runs, then verify archived blocks it.
    const downgradeArchived = await downgradeUC.execute({
      reportId,
      callerId: admin,
    });
    expect(downgradeArchived.success).toBe(false);

    if (!downgradeArchived.success) {
      expect(downgradeArchived.error).toBe('domain.report.archived');
    }

    const publishArchived = await publishUC.execute({
      reportId,
      callerId: admin,
      notifyAudience: false,
    });
    expect(publishArchived.success).toBe(false);

    // archived-then-published returns REPORT_ARCHIVED (domain) since state is still PUBLISHED;
    // the publish path checks archived first, so we expect a domain.report.* code.
    if (!publishArchived.success) {
      expect(publishArchived.error.startsWith('domain.report.')).toBe(true);
    }
  });

  it('non-admin cannot publish', async () => {
    const created = await createUC.execute({
      userId: author,
      organizationId: orgId,
      title: 'X',
      body: 'Y',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      boardIds: [],
    });
    expect(created.success).toBe(true);

    if (!created.success) {
      return;
    }

    const r = await publishUC.execute({
      reportId: created.value.id,
      callerId: author,
      notifyAudience: false,
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.NOT_ORG_ADMIN);
    }
  });
});
