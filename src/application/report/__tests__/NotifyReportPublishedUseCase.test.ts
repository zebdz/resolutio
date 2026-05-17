import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyReportPublishedUseCase } from '../NotifyReportPublishedUseCase';
import { Report, ReportProps } from '../../../domain/report/Report';
import { ReportVisibility } from '../../../domain/report/ReportVisibility';
import { Notification } from '../../../domain/notification/Notification';

const baseProps = (overrides: Partial<ReportProps> = {}): ReportProps => ({
  id: 'r1',
  organizationId: 'org-1',
  createdById: 'author-1',
  title: 'Test Title',
  body: 'b',
  visibility: ReportVisibility.WITHIN_ORG_ONLY,
  state: 'PUBLISHED',
  publishedById: 'admin-1',
  lastPublishedAt: new Date(),
  notifyAudience: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  boardIds: [],
  pollIds: [],
  attachmentIds: [],
  ...overrides,
});

class FakeOrgs {
  ancestors = new Map<string, string[]>();
  descendants = new Map<string, string[]>();
  treeMinusSelf = new Map<string, string[]>();
  memberIdsForOrgs = new Map<string, string[]>(); // key=sorted orgIds.join(',')
  async getAncestorIds(orgId: string) {
    return this.ancestors.get(orgId) ?? [];
  }
  async getDescendantIds(orgId: string) {
    return this.descendants.get(orgId) ?? [];
  }
  async getFullTreeOrgIds(orgId: string) {
    return this.treeMinusSelf.get(orgId) ?? [];
  }
  async findAcceptedMemberUserIdsForOrgs(orgIds: string[]) {
    return this.memberIdsForOrgs.get([...orgIds].sort().join(',')) ?? [];
  }
}

class FakeBoards {
  members = new Map<string, string[]>();
  async findBoardMembers(boardId: string) {
    return (this.members.get(boardId) ?? []).map((userId) => ({ userId }));
  }
}

class FakeNotifications {
  saved: Notification[] = [];
  async save(n: Notification): Promise<Notification> {
    this.saved.push(n);

    return n;
  }
  async saveBatch(ns: Notification[]): Promise<void> {
    for (const n of ns) {
      this.saved.push(n);
    }
  }
}

describe('NotifyReportPublishedUseCase', () => {
  let orgs: FakeOrgs;
  let boards: FakeBoards;
  let notifications: FakeNotifications;
  let uc: NotifyReportPublishedUseCase;

  beforeEach(() => {
    orgs = new FakeOrgs();
    boards = new FakeBoards();
    notifications = new FakeNotifications();
    uc = new NotifyReportPublishedUseCase({
      orgRepo: orgs as any,

      boardRepo: boards as any,

      notificationRepository: notifications as any,
    });
  });

  it('WITHIN_ORG_ONLY: notifies exact-org members, skips author', async () => {
    orgs.memberIdsForOrgs.set('org-1', ['author-1', 'u1', 'u2']);
    const r = Report.reconstitute(baseProps());
    await uc.notifyPublished(r);
    const userIds = notifications.saved.map((n) => n.userId).sort();
    expect(userIds).toEqual(['u1', 'u2']);
  });

  it('WITHIN_ORG_ANCESTORS: notifies exact + ancestor members', async () => {
    orgs.ancestors.set('org-1', ['parent-1']);
    orgs.memberIdsForOrgs.set('org-1,parent-1', ['u-org', 'u-parent']);
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.WITHIN_ORG_ANCESTORS })
    );
    await uc.notifyPublished(r);
    expect(notifications.saved.map((n) => n.userId).sort()).toEqual([
      'u-org',
      'u-parent',
    ]);
  });

  it('WITHIN_ORG_DESCENDANTS: notifies exact + descendant members', async () => {
    orgs.descendants.set('org-1', ['child-1']);
    orgs.memberIdsForOrgs.set('child-1,org-1', ['u-org', 'u-child']);
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.WITHIN_ORG_DESCENDANTS })
    );
    await uc.notifyPublished(r);
    expect(notifications.saved.map((n) => n.userId).sort()).toEqual([
      'u-child',
      'u-org',
    ]);
  });

  it('WITHIN_ORG_TREE: notifies entire tree', async () => {
    orgs.treeMinusSelf.set('org-1', ['parent-1', 'child-1']);
    orgs.memberIdsForOrgs.set('child-1,org-1,parent-1', [
      'u-org',
      'u-parent',
      'u-child',
    ]);
    const r = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.WITHIN_ORG_TREE })
    );
    await uc.notifyPublished(r);
    expect(notifications.saved.map((n) => n.userId).sort()).toEqual([
      'u-child',
      'u-org',
      'u-parent',
    ]);
  });

  it('WITHIN_BOARDS: notifies union of board members, dedup, skips author', async () => {
    boards.members.set('b1', ['author-1', 'u1', 'u2']);
    boards.members.set('b2', ['u2', 'u3']);
    const r = Report.reconstitute(
      baseProps({
        visibility: ReportVisibility.WITHIN_BOARDS,
        boardIds: ['b1', 'b2'],
      })
    );
    await uc.notifyPublished(r);
    expect(notifications.saved.map((n) => n.userId).sort()).toEqual([
      'u1',
      'u2',
      'u3',
    ]);
  });

  it('PUBLIC_ANON / PUBLIC_AUTH: no-op', async () => {
    const r1 = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.PUBLIC_ANON })
    );
    const r2 = Report.reconstitute(
      baseProps({ visibility: ReportVisibility.PUBLIC_AUTH })
    );
    await uc.notifyPublished(r1);
    await uc.notifyPublished(r2);
    expect(notifications.saved).toHaveLength(0);
  });

  it('records notification type "report_published" with reportId + title in data', async () => {
    orgs.memberIdsForOrgs.set('org-1', ['u1']);
    const r = Report.reconstitute(baseProps());
    await uc.notifyPublished(r);
    expect(notifications.saved).toHaveLength(1);
    const n = notifications.saved[0];
    expect(n.type).toBe('report_published');
    expect(n.data).toMatchObject({
      reportId: 'r1',
      organizationId: 'org-1',
      title: 'Test Title',
    });
  });
});
