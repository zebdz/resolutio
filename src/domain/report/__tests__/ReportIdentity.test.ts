/** Report clients provide identity/time; stored lifecycle metadata cannot bypass invariants.
 * Historical publication time remains available when a published report returns to draft. */
import { ReportTitle, ReportBody } from '@/domain/report/ReportValues';
import { expect, it } from 'vitest';
import { Report } from '../Report';
import { ReportVisibility } from '../ReportVisibility';
import {
  ReportId,
  OrganizationId,
  UserId,
  PollId,
  ReportAttachmentId,
} from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { Instant } from '../../shared/Instant';
import { ReportDomainCodes } from '../ReportDomainCodes';

function stored() {
  return {
    id: 'report-1',
    organizationId: 'org-1',
    createdById: 'user-1',
    title: 'Report',
    body: 'Body',
    visibility: ReportVisibility.WITHIN_ORG_ONLY,
    state: 'DRAFT' as const,
    publishedById: null,
    lastPublishedAt: null,
    notifyAudience: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    archivedAt: null,
    boardIds: [],
    pollIds: [],
    attachmentIds: [],
  };
}

it('creates a draft with the supplied identity and creation instant', () => {
  const creation = testCreation(ReportId, 'report-1');
  const result = Report.create(
    {
      title: ReportTitle.parse('Report'),
      body: ReportBody.parse('Body'),
      organizationId: OrganizationId.parse('org-1'),
      createdById: UserId.parse('user-1'),
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      boardIds: [],
    },
    creation
  );
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(result.value.id).toBe(creation.id);
  expect(result.value.createdAt.toISOString()).toBe(creation.now);
});

it('rejects impossible persisted publication and audience states', () => {
  expect(() =>
    Report.reconstitute({ ...stored(), state: 'PUBLISHED' })
  ).toThrow();
  expect(() =>
    Report.reconstitute({
      ...stored(),
      visibility: ReportVisibility.WITHIN_BOARDS,
    })
  ).toThrow();
  expect(() =>
    Report.reconstitute({ ...stored(), boardIds: ['board-1'] })
  ).toThrow();
  expect(() => Report.reconstitute({ ...stored(), id: '' })).toThrow();
});

it('uses explicit mutation time and retains publication history when returning to draft', () => {
  const report = Report.reconstitute(stored());
  const publishedAt = Instant.parse('2026-02-01T00:00:00.000Z');
  expect(
    report.publish(UserId.parse('publisher-1'), true, publishedAt).success
  ).toBe(true);
  expect(report.lastPublishedAt?.toISOString()).toBe(publishedAt);
  const draftAt = Instant.parse('2026-03-01T00:00:00.000Z');
  expect(report.downgradeToDraft(draftAt).success).toBe(true);
  expect(report.publishedById).toBeNull();
  expect(report.lastPublishedAt?.toISOString()).toBe(publishedAt);
  expect(report.updatedAt.toISOString()).toBe(draftAt);
  report.updatedAt.setUTCFullYear(2000);
  expect(report.updatedAt.toISOString()).toBe(draftAt);
});

it('rejects invalid instants before changing draft content or references', () => {
  const report = Report.reconstitute(stored());
  const invalidTime = 'not-an-instant' as Instant;
  expect(() =>
    report.updateTitle(ReportTitle.parse('Changed title'), invalidTime)
  ).toThrow();
  expect(() =>
    report.updateBody(ReportBody.parse('Changed body'), invalidTime)
  ).toThrow();
  expect(() =>
    report.attachPoll(PollId.parse('poll-1'), invalidTime)
  ).toThrow();
  expect(() =>
    report.attachAttachment(ReportAttachmentId.parse('file-1'), invalidTime)
  ).toThrow();
  expect(report.title).toBe('Report');
  expect(report.body).toBe('Body');
  expect(report.pollIds).toEqual([]);
  expect(report.attachmentIds).toEqual([]);
});

it('reports unsupported audience values without creating or changing a report', () => {
  const invalidVisibility = 'UNSUPPORTED' as ReportVisibility;
  const result = Report.create(
    {
      title: ReportTitle.parse('Report'),
      body: ReportBody.parse('Body'),
      organizationId: OrganizationId.parse('org-1'),
      createdById: UserId.parse('user-1'),
      visibility: invalidVisibility,
      boardIds: [],
    },
    testCreation(ReportId, 'report-1')
  );
  expect(result).toEqual({
    success: false,
    error: ReportDomainCodes.REPORT_INVALID_VISIBILITY,
  });
  const report = Report.reconstitute(stored());
  expect(
    report.setVisibility(
      invalidVisibility,
      [],
      Instant.parse('2026-02-01T00:00:00.000Z')
    )
  ).toEqual({
    success: false,
    error: ReportDomainCodes.REPORT_INVALID_VISIBILITY,
  });
  expect(report.visibility).toBe(ReportVisibility.WITHIN_ORG_ONLY);
});
