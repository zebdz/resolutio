import { describe, it, expect, beforeEach } from 'vitest';
import { GetReportForViewerUseCase } from '../GetReportForViewerUseCase';
import { ResolveReportVisibilityService } from '../ResolveReportVisibilityService';
import { Report, ReportProps } from '../../../domain/report/Report';
import { ReportVisibility } from '../../../domain/report/ReportVisibility';
import { ReportErrors } from '../ReportErrors';
import { success } from '../../../domain/shared/Result';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

const baseProps = (overrides: Partial<ReportProps> = {}): ReportProps => ({
  id: 'r1',
  organizationId: 'org-1',
  createdById: 'author-1',
  title: 'My Report',
  body: 'body text',
  visibility: ReportVisibility.PUBLIC_ANON,
  state: 'PUBLISHED',
  publishedById: 'author-1',
  lastPublishedAt: new Date('2025-01-01'),
  notifyAudience: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  archivedAt: null,
  boardIds: [],
  pollIds: [],
  attachmentIds: ['att-1'],
  ...overrides,
});

class FakeReportRepo {
  private reports = new Map<string, Report>();

  seed(report: Report) {
    this.reports.set(report.id, report);
  }

  async findByIdWithRelations(id: string) {
    const report = this.reports.get(id);

    if (!report) {
      return success(null);
    }

    return success(report);
  }
}

class FakeOrgRepo {
  exactMembers = new Map<string, Set<string>>();
  admins = new Map<string, Set<string>>();

  async isUserExactMember(userId: string, orgId: string) {
    return this.exactMembers.get(orgId)?.has(userId) ?? false;
  }
  async isUserAdmin(userId: string, orgId: string) {
    return this.admins.get(orgId)?.has(userId) ?? false;
  }
  async getAncestorIds() {
    return [];
  }
  async getDescendantIds() {
    return [];
  }
  async getFullTreeOrgIds() {
    return [];
  }
}

class FakeBoardRepo {
  members = new Map<string, Set<string>>();
  async isUserMember(userId: string, boardId: string) {
    return this.members.get(boardId)?.has(userId) ?? false;
  }
}

class FakeUserRepo {
  superadmins = new Set<string>();
  async isSuperAdmin(userId: string) {
    return this.superadmins.has(userId);
  }
}

class FakeAttachmentRepo {
  private data = new Map<
    string,
    Array<{
      id: string;
      reportId: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: Date;
    }>
  >();

  seed(
    reportId: string,
    attachments: Array<{
      id: string;
      reportId: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: Date;
    }>
  ) {
    this.data.set(reportId, attachments);
  }

  async findByReportId(reportId: string) {
    return success(this.data.get(reportId) ?? []);
  }
}

class FakePollRepo {
  private polls = new Map<
    string,
    {
      id: string;
      title: string;
      state: string;
      archivedAt: Date | null;
      organizationId: string;
      boardId: string | null;
    }
  >();

  seedPoll(poll: {
    id: string;
    title: string;
    state: string;
    archivedAt: Date | null;
    organizationId: string;
    boardId: string | null;
  }) {
    this.polls.set(poll.id, poll);
  }

  async getPollById(id: string) {
    const poll = this.polls.get(id);

    if (!poll) {
      return success(null);
    }

    // Return something with the shape the use case expects
    return success(poll as any);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUseCase(
  repo: FakeReportRepo,
  orgs: FakeOrgRepo,
  boards: FakeBoardRepo,
  users: FakeUserRepo,
  attachments: FakeAttachmentRepo,
  polls: FakePollRepo
) {
  const svc = new ResolveReportVisibilityService(orgs, boards, users);

  return new GetReportForViewerUseCase(
    repo as any,
    svc,
    attachments as any,
    polls as any
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GetReportForViewerUseCase', () => {
  let repo: FakeReportRepo;
  let orgs: FakeOrgRepo;
  let boards: FakeBoardRepo;
  let users: FakeUserRepo;
  let attachments: FakeAttachmentRepo;
  let polls: FakePollRepo;
  let uc: GetReportForViewerUseCase;

  beforeEach(() => {
    repo = new FakeReportRepo();
    orgs = new FakeOrgRepo();
    boards = new FakeBoardRepo();
    users = new FakeUserRepo();
    attachments = new FakeAttachmentRepo();
    polls = new FakePollRepo();
    uc = makeUseCase(repo, orgs, boards, users, attachments, polls);
  });

  it('author reads own draft → success with report, attachments, and polls', async () => {
    const report = Report.reconstitute(
      baseProps({
        state: 'DRAFT',
        visibility: ReportVisibility.WITHIN_ORG_ONLY,
        pollIds: ['poll-1'],
        attachmentIds: ['att-1'],
      })
    );
    repo.seed(report);

    attachments.seed('r1', [
      {
        id: 'att-1',
        reportId: 'r1',
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        createdAt: new Date('2025-01-01'),
      },
    ]);

    polls.seedPoll({
      id: 'poll-1',
      title: 'Poll One',
      state: 'ACTIVE',
      archivedAt: null,
      organizationId: 'org-1',
      boardId: null,
    });

    const result = await uc.execute({ reportId: 'r1', viewerId: 'author-1' });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.value.report.id).toBe('r1');
    expect(result.value.attachments).toHaveLength(1);
    expect(result.value.attachments[0].fileName).toBe('file.pdf');
    expect(result.value.polls).toHaveLength(1);
    expect(result.value.polls[0].title).toBe('Poll One');
    expect(result.value.polls[0].archivedAt).toBeNull();
  });

  it('anon viewer reads public-anon published → success', async () => {
    const report = Report.reconstitute(
      baseProps({
        visibility: ReportVisibility.PUBLIC_ANON,
        state: 'PUBLISHED',
      })
    );
    repo.seed(report);
    attachments.seed('r1', []);

    const result = await uc.execute({ reportId: 'r1', viewerId: null });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.value.report.id).toBe('r1');
  });

  it('anon viewer reads public-auth published → REPORT_NOT_FOUND', async () => {
    const report = Report.reconstitute(
      baseProps({
        visibility: ReportVisibility.PUBLIC_AUTH,
        state: 'PUBLISHED',
      })
    );
    repo.seed(report);

    const result = await uc.execute({ reportId: 'r1', viewerId: null });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.error).toBe(ReportErrors.REPORT_NOT_FOUND);
  });

  it('non-member reads within-org published → REPORT_NOT_FOUND', async () => {
    const report = Report.reconstitute(
      baseProps({
        visibility: ReportVisibility.WITHIN_ORG_ONLY,
        state: 'PUBLISHED',
      })
    );
    repo.seed(report);

    // u-stranger is NOT a member of org-1
    const result = await uc.execute({ reportId: 'r1', viewerId: 'u-stranger' });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.error).toBe(ReportErrors.REPORT_NOT_FOUND);
  });

  it('report missing → REPORT_NOT_FOUND', async () => {
    const result = await uc.execute({
      reportId: 'non-existent',
      viewerId: null,
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.error).toBe(ReportErrors.REPORT_NOT_FOUND);
  });

  it('includes attachment metadata in result', async () => {
    const report = Report.reconstitute(
      baseProps({
        visibility: ReportVisibility.PUBLIC_ANON,
        state: 'PUBLISHED',
        attachmentIds: ['att-1', 'att-2'],
      })
    );
    repo.seed(report);

    const createdAt = new Date('2025-06-01');
    attachments.seed('r1', [
      {
        id: 'att-1',
        reportId: 'r1',
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        createdAt,
      },
      {
        id: 'att-2',
        reportId: 'r1',
        fileName: 'img.png',
        mimeType: 'image/png',
        sizeBytes: 512,
        createdAt,
      },
    ]);

    const result = await uc.execute({ reportId: 'r1', viewerId: null });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.value.attachments).toHaveLength(2);
    expect(result.value.attachments[0].sizeBytes).toBe(2048);
    expect(result.value.attachments[1].mimeType).toBe('image/png');
  });

  it('includes poll metadata with archivedAt for archived polls', async () => {
    const archivedAt = new Date('2025-03-01');
    const report = Report.reconstitute(
      baseProps({
        visibility: ReportVisibility.PUBLIC_ANON,
        state: 'PUBLISHED',
        pollIds: ['poll-active', 'poll-archived'],
      })
    );
    repo.seed(report);
    attachments.seed('r1', []);

    polls.seedPoll({
      id: 'poll-active',
      title: 'Active Poll',
      state: 'ACTIVE',
      archivedAt: null,
      organizationId: 'org-1',
      boardId: null,
    });
    polls.seedPoll({
      id: 'poll-archived',
      title: 'Archived Poll',
      state: 'FINISHED',
      archivedAt,
      organizationId: 'org-1',
      boardId: null,
    });

    const result = await uc.execute({ reportId: 'r1', viewerId: null });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    const activePoll = result.value.polls.find((p) => p.id === 'poll-active');
    const archivedPoll = result.value.polls.find(
      (p) => p.id === 'poll-archived'
    );

    expect(activePoll?.archivedAt).toBeNull();
    expect(archivedPoll?.archivedAt).toEqual(archivedAt);
  });

  it('drops polls that returned null from the repo', async () => {
    const report = Report.reconstitute(
      baseProps({
        visibility: ReportVisibility.PUBLIC_ANON,
        state: 'PUBLISHED',
        pollIds: ['poll-exists', 'poll-missing'],
      })
    );
    repo.seed(report);
    attachments.seed('r1', []);

    polls.seedPoll({
      id: 'poll-exists',
      title: 'Exists',
      state: 'DRAFT',
      archivedAt: null,
      organizationId: 'org-1',
      boardId: null,
    });
    // poll-missing is NOT seeded

    const result = await uc.execute({ reportId: 'r1', viewerId: null });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.value.polls).toHaveLength(1);
    expect(result.value.polls[0].id).toBe('poll-exists');
  });
});
