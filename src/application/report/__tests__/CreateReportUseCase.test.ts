import { describe, it, expect, beforeEach } from 'vitest';
import { CreateReportUseCase } from '../CreateReportUseCase';
import { ReportVisibility } from '../../../domain/report/ReportVisibility';
import { ReportErrors } from '../ReportErrors';
import { ReportDomainCodes } from '../../../domain/report/ReportDomainCodes';
import { Report } from '../../../domain/report/Report';

function unwrap<T>(
  r: { success: true; value: T } | { success: false; error: string }
): T {
  if (!r.success) {
    throw new Error(`Expected success, got: ${r.error}`);
  }

  return r.value;
}

class FakeReportRepo {
  saved: Report[] = [];
  async create(r: Report) {
    this.saved.push(r);

    return { success: true as const, value: r };
  }
}

class FakeOrgRepo {
  members = new Set<string>(); // `${userId}:${orgId}`
  async isUserExactMember(userId: string, orgId: string) {
    return this.members.has(`${userId}:${orgId}`);
  }
}

class FakeBoardRepo {
  byOrg = new Map<string, string[]>(); // orgId -> boardIds
  async findByOrganizationId(orgId: string) {
    const ids = this.byOrg.get(orgId) ?? [];

    return ids.map((id) => ({ id, name: `board-${id}` }));
  }
}

describe('CreateReportUseCase', () => {
  let repo: FakeReportRepo;
  let orgs: FakeOrgRepo;
  let boards: FakeBoardRepo;
  let uc: CreateReportUseCase;

  beforeEach(() => {
    repo = new FakeReportRepo();
    orgs = new FakeOrgRepo();
    boards = new FakeBoardRepo();

    uc = new CreateReportUseCase(repo as any, orgs as any, boards as any);
  });

  it('creates a Draft report for an org member', async () => {
    orgs.members.add('u1:org-1');
    const r = await uc.execute({
      userId: 'u1',
      organizationId: 'org-1',
      title: 'T',
      body: 'B',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      boardIds: [],
    });
    expect(r.success).toBe(true);
    const created = unwrap(r);
    expect(created.state).toBe('DRAFT');
    expect(created.title).toBe('T');
    expect(repo.saved).toHaveLength(1);
  });

  it('rejects non-member', async () => {
    const r = await uc.execute({
      userId: 'u1',
      organizationId: 'org-1',
      title: 'T',
      body: 'B',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      boardIds: [],
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportErrors.NOT_ORG_MEMBER);
    }
  });

  it('rejects WITHIN_BOARDS scope referencing a board from another org', async () => {
    orgs.members.add('u1:org-1');
    boards.byOrg.set('org-1', ['b1']);
    const r = await uc.execute({
      userId: 'u1',
      organizationId: 'org-1',
      title: 'T',
      body: 'B',
      visibility: ReportVisibility.WITHIN_BOARDS,
      boardIds: ['b1', 'foreign-board'],
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_BOARD_NOT_IN_ORG);
    }
  });

  it('accepts WITHIN_BOARDS with same-org boards', async () => {
    orgs.members.add('u1:org-1');
    boards.byOrg.set('org-1', ['b1', 'b2']);
    const r = await uc.execute({
      userId: 'u1',
      organizationId: 'org-1',
      title: 'T',
      body: 'B',
      visibility: ReportVisibility.WITHIN_BOARDS,
      boardIds: ['b1', 'b2'],
    });
    expect(r.success).toBe(true);
    const created = unwrap(r);
    expect(created.boardIds).toEqual(['b1', 'b2']);
  });

  it('rejects empty title via domain', async () => {
    orgs.members.add('u1:org-1');
    const r = await uc.execute({
      userId: 'u1',
      organizationId: 'org-1',
      title: '   ',
      body: 'B',
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      boardIds: [],
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_TITLE_EMPTY);
    }
  });
});
