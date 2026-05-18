import { describe, it, expect, beforeEach } from 'vitest';
import { ResolveReportVisibilityService } from '../ResolveReportVisibilityService';
import { Report, ReportProps } from '../../../domain/report/Report';
import { ReportVisibility } from '../../../domain/report/ReportVisibility';

class FakeOrgRepo {
  exactMembers = new Map<string, Set<string>>(); // orgId -> userIds
  admins = new Map<string, Set<string>>(); // orgId -> userIds
  ancestors = new Map<string, string[]>();
  descendants = new Map<string, string[]>();
  treeMinusSelf = new Map<string, string[]>();

  async isUserExactMember(userId: string, orgId: string) {
    return this.exactMembers.get(orgId)?.has(userId) ?? false;
  }
  async isUserAdmin(userId: string, orgId: string) {
    return this.admins.get(orgId)?.has(userId) ?? false;
  }
  async getAncestorIds(orgId: string) {
    return this.ancestors.get(orgId) ?? [];
  }
  async getDescendantIds(orgId: string) {
    return this.descendants.get(orgId) ?? [];
  }
  async getFullTreeOrgIds(orgId: string) {
    return this.treeMinusSelf.get(orgId) ?? [];
  }
}

class FakeBoardRepo {
  members = new Map<string, Set<string>>(); // boardId -> userIds
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

const baseProps = (overrides: Partial<ReportProps> = {}): ReportProps => ({
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

describe('ResolveReportVisibilityService.canRead', () => {
  let svc: ResolveReportVisibilityService;
  let orgs: FakeOrgRepo;
  let boards: FakeBoardRepo;
  let users: FakeUserRepo;

  beforeEach(() => {
    orgs = new FakeOrgRepo();
    boards = new FakeBoardRepo();
    users = new FakeUserRepo();
    svc = new ResolveReportVisibilityService(orgs, boards, users);
  });

  it('PUBLIC_ANON: anon viewer can read PUBLISHED', async () => {
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.PUBLIC_ANON })
    );
    expect(await svc.canRead(r, null)).toBe(true);
  });

  it('PUBLIC_ANON: anon viewer cannot read DRAFT', async () => {
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.PUBLIC_ANON, state: 'DRAFT' })
    );
    expect(await svc.canRead(r, null)).toBe(false);
  });

  it('PUBLIC_AUTH: anon viewer cannot read', async () => {
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.PUBLIC_AUTH })
    );
    expect(await svc.canRead(r, null)).toBe(false);
  });

  it('PUBLIC_AUTH: any logged-in user can read', async () => {
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.PUBLIC_AUTH })
    );
    expect(await svc.canRead(r, 'random-user')).toBe(true);
  });

  it('WITHIN_ORG_ONLY: org member can read; non-member cannot; descendant-org member does NOT see', async () => {
    orgs.exactMembers.set('org-1', new Set(['u1']));
    // u-child is a member of a child org but NOT the report's exact org
    orgs.descendants.set('org-1', ['child-1']);
    orgs.exactMembers.set('child-1', new Set(['u-child']));
    const r = Report.reconstitute(baseProps());
    expect(await svc.canRead(r, 'u1')).toBe(true);
    expect(await svc.canRead(r, 'u2')).toBe(false);
    expect(await svc.canRead(r, 'u-child')).toBe(false);
  });

  it('WITHIN_ORG_ANCESTORS: ancestor-org member can read; descendant-org member cannot', async () => {
    orgs.ancestors.set('org-1', ['parent-1']);
    orgs.exactMembers.set('parent-1', new Set(['u-parent']));
    orgs.exactMembers.set('org-1', new Set(['u-org']));
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.WITHIN_ORG_ANCESTORS })
    );
    expect(await svc.canRead(r, 'u-parent')).toBe(true);
    expect(await svc.canRead(r, 'u-org')).toBe(true);
    expect(await svc.canRead(r, 'random')).toBe(false);
  });

  it('WITHIN_ORG_DESCENDANTS: descendant-org member can read; ancestor-org member cannot', async () => {
    orgs.descendants.set('org-1', ['child-1']);
    orgs.exactMembers.set('child-1', new Set(['u-child']));
    orgs.exactMembers.set('org-1', new Set(['u-org']));
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.WITHIN_ORG_DESCENDANTS })
    );
    expect(await svc.canRead(r, 'u-child')).toBe(true);
    expect(await svc.canRead(r, 'u-org')).toBe(true);
    expect(await svc.canRead(r, 'random')).toBe(false);
  });

  it('WITHIN_ORG_TREE: any tree-member can read', async () => {
    orgs.treeMinusSelf.set('org-1', ['parent-1', 'child-1']);
    orgs.exactMembers.set('parent-1', new Set(['u-parent']));
    orgs.exactMembers.set('child-1', new Set(['u-child']));
    orgs.exactMembers.set('org-1', new Set(['u-org']));
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.WITHIN_ORG_TREE })
    );
    expect(await svc.canRead(r, 'u-parent')).toBe(true);
    expect(await svc.canRead(r, 'u-child')).toBe(true);
    expect(await svc.canRead(r, 'u-org')).toBe(true);
    expect(await svc.canRead(r, 'random')).toBe(false);
  });

  it('WITHIN_BOARDS: member of any listed board can read', async () => {
    boards.members.set('b1', new Set(['u-b1']));
    boards.members.set('b2', new Set(['u-b2']));
    const r = Report.reconstitute(
      baseProps({
        visibility: ReportVisibility.WITHIN_BOARDS,
        boardIds: ['b1', 'b2'],
      })
    );
    expect(await svc.canRead(r, 'u-b1')).toBe(true);
    expect(await svc.canRead(r, 'u-b2')).toBe(true);
    expect(await svc.canRead(r, 'u-other')).toBe(false);
  });

  it('override: author reads own report in any state', async () => {
    const r = Report.reconstitute(
      baseProps({
        visibility: ReportVisibility.WITHIN_BOARDS,
        boardIds: ['b1'],
        state: 'DRAFT',
      })
    );
    expect(await svc.canRead(r, 'author-1')).toBe(true);
  });

  it('override: org admin reads draft', async () => {
    orgs.admins.set('org-1', new Set(['admin-1']));
    const r = Report.reconstitute(baseProps({ state: 'DRAFT' }));
    expect(await svc.canRead(r, 'admin-1')).toBe(true);
  });

  it('override: superadmin reads any', async () => {
    users.superadmins.add('su');
    const r = Report.reconstitute(baseProps({ state: 'DRAFT' }));
    expect(await svc.canRead(r, 'su')).toBe(true);
  });

  it('archived report: nobody reads except author/admin/superadmin', async () => {
    orgs.exactMembers.set('org-1', new Set(['u1']));
    const r = Report.reconstitute(baseProps({ archivedAt: new Date() }));
    expect(await svc.canRead(r, 'u1')).toBe(false);
    expect(await svc.canRead(r, 'author-1')).toBe(true);
  });
});
