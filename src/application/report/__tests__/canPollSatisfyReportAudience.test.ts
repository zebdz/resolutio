import { OrganizationId, BoardId } from '@/domain/shared/EntityIds';
import { describe, it, expect } from 'vitest';
import { canPollSatisfyReportAudience } from '../canPollSatisfyReportAudience';
import { Report, ReportData } from '../../../domain/report/Report';
import { ReportVisibility } from '../../../domain/report/ReportVisibility';
import { PollState } from '../../../domain/poll/PollState';

const makeReport = (overrides: Partial<ReportData> = {}) =>
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
    ...(overrides.state === 'PUBLISHED'
      ? {
          publishedById: overrides.publishedById ?? 'admin-1',
          lastPublishedAt: overrides.lastPublishedAt ?? new Date('2026-01-01'),
        }
      : {}),
  });

const orgPoll = {
  organizationId: OrganizationId.parse('org-1'),
  boardId: null,
  state: PollState.FINISHED,
};
const boardPoll = {
  organizationId: OrganizationId.parse('org-1'),
  boardId: BoardId.parse('b1'),
  state: PollState.FINISHED,
};
const foreignBoardPoll = {
  organizationId: OrganizationId.parse('org-1'),
  boardId: BoardId.parse('b-foreign'),
  state: PollState.FINISHED,
};

describe('canPollSatisfyReportAudience', () => {
  it('PUBLIC_ANON → false (no polls have public flag)', () => {
    const report = makeReport({ visibility: ReportVisibility.PUBLIC_ANON });
    expect(canPollSatisfyReportAudience(orgPoll, report)).toBe(false);
  });

  it('PUBLIC_AUTH → false', () => {
    const report = makeReport({ visibility: ReportVisibility.PUBLIC_AUTH });
    expect(canPollSatisfyReportAudience(orgPoll, report)).toBe(false);
  });

  it('WITHIN_ORG_ONLY → true when same org, no board', () => {
    const report = makeReport({ visibility: ReportVisibility.WITHIN_ORG_ONLY });
    expect(canPollSatisfyReportAudience(orgPoll, report)).toBe(true);
  });

  it('WITHIN_ORG_ONLY → false when poll has a board', () => {
    const report = makeReport({ visibility: ReportVisibility.WITHIN_ORG_ONLY });
    expect(canPollSatisfyReportAudience(boardPoll, report)).toBe(false);
  });

  it('WITHIN_ORG_ANCESTORS → false in v1', () => {
    const report = makeReport({
      visibility: ReportVisibility.WITHIN_ORG_ANCESTORS,
    });
    expect(canPollSatisfyReportAudience(orgPoll, report)).toBe(false);
  });

  it('WITHIN_BOARDS → true when same org and poll boardId is in report boardIds', () => {
    const report = makeReport({
      visibility: ReportVisibility.WITHIN_BOARDS,
      boardIds: ['b1', 'b2'],
    });
    expect(canPollSatisfyReportAudience(boardPoll, report)).toBe(true);
  });

  it('WITHIN_BOARDS → false when poll boardId is NOT in report boardIds', () => {
    const report = makeReport({
      visibility: ReportVisibility.WITHIN_BOARDS,
      boardIds: ['b1', 'b2'],
    });
    expect(canPollSatisfyReportAudience(foreignBoardPoll, report)).toBe(false);
  });

  it.each([PollState.DRAFT, PollState.READY, PollState.ACTIVE])(
    'non-FINISHED poll (%s) → false even if audience matches',
    (state) => {
      const report = makeReport({
        visibility: ReportVisibility.WITHIN_ORG_ONLY,
      });
      const poll = { ...orgPoll, state };
      expect(canPollSatisfyReportAudience(poll, report)).toBe(false);
    }
  );
});
