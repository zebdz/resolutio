import { describe, it, expect } from 'vitest';
import {
  Report,
  REPORT_TITLE_MAX_LENGTH,
  REPORT_BODY_MAX_LENGTH,
} from '../Report';
import { ReportVisibility } from '../ReportVisibility';
import { ReportDomainCodes } from '../ReportDomainCodes';

const make = (overrides: Partial<Parameters<typeof Report.create>[0]> = {}) =>
  Report.create({
    title: 'Title',
    body: 'Body',
    organizationId: 'org-1',
    createdById: 'user-1',
    visibility: ReportVisibility.WITHIN_ORG_ONLY,
    boardIds: [],
    ...overrides,
  });

function unwrap<T>(
  r: { success: true; value: T } | { success: false; error: string }
): T {
  if (!r.success) {
    throw new Error(`Expected success, got error: ${r.error}`);
  }

  return r.value;
}

describe('Report.create', () => {
  it('creates a Draft report with valid input', () => {
    const r = make();
    expect(r.success).toBe(true);

    if (r.success) {
      expect(r.value.state).toBe('DRAFT');
      expect(r.value.title).toBe('Title');
      expect(r.value.visibility).toBe(ReportVisibility.WITHIN_ORG_ONLY);
      expect(r.value.lastPublishedAt).toBeNull();
      expect(r.value.publishedById).toBeNull();
      expect(r.value.archivedAt).toBeNull();
    }
  });

  it('rejects empty title', () => {
    const r = make({ title: '   ' });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_TITLE_EMPTY);
    }
  });

  it('rejects title too long', () => {
    const r = make({ title: 'a'.repeat(REPORT_TITLE_MAX_LENGTH + 1) });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_TITLE_TOO_LONG);
    }
  });

  it('rejects empty body', () => {
    const r = make({ body: '   ' });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_BODY_EMPTY);
    }
  });

  it('rejects body too long', () => {
    const r = make({ body: 'a'.repeat(REPORT_BODY_MAX_LENGTH + 1) });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_BODY_TOO_LONG);
    }
  });

  it('rejects WITHIN_BOARDS visibility without boardIds', () => {
    const r = make({
      visibility: ReportVisibility.WITHIN_BOARDS,
      boardIds: [],
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_BOARDS_EMPTY);
    }
  });

  it('accepts WITHIN_BOARDS with boards', () => {
    const r = make({
      visibility: ReportVisibility.WITHIN_BOARDS,
      boardIds: ['b1', 'b2'],
    });
    expect(r.success).toBe(true);

    if (r.success) {
      expect(r.value.boardIds).toEqual(['b1', 'b2']);
    }
  });

  it('drops boardIds when visibility is not WITHIN_BOARDS', () => {
    const r = make({
      visibility: ReportVisibility.WITHIN_ORG_ONLY,
      boardIds: ['b1'],
    });
    expect(r.success).toBe(true);

    if (r.success) {
      expect(r.value.boardIds).toEqual([]);
    }
  });
});

describe('Report state machine', () => {
  it('publish: DRAFT → PUBLISHED, sets publishedBy + lastPublishedAt', () => {
    const r = unwrap(make());
    const before = new Date();
    const res = r.publish('admin-1', false);
    expect(res.success).toBe(true);
    expect(r.state).toBe('PUBLISHED');
    expect(r.publishedById).toBe('admin-1');
    expect(r.lastPublishedAt).not.toBeNull();
    expect(r.lastPublishedAt!.getTime()).toBeGreaterThanOrEqual(
      before.getTime()
    );
  });

  it('publish: rejects when not Draft', () => {
    const r = unwrap(make());
    r.publish('admin-1', false);
    const second = r.publish('admin-1', false);
    expect(second.success).toBe(false);

    if (!second.success) {
      expect(second.error).toBe(ReportDomainCodes.REPORT_MUST_BE_DRAFT);
    }
  });

  it('publish: forces notifyAudience=false for PUBLIC_ANON', () => {
    const r = unwrap(make({ visibility: ReportVisibility.PUBLIC_ANON }));
    r.publish('admin-1', true);
    expect(r.notifyAudience).toBe(false);
  });

  it('publish: forces notifyAudience=false for PUBLIC_AUTH', () => {
    const r = unwrap(make({ visibility: ReportVisibility.PUBLIC_AUTH }));
    r.publish('admin-1', true);
    expect(r.notifyAudience).toBe(false);
  });

  it('publish: honors notifyAudience for WITHIN_ORG_ONLY', () => {
    const r = unwrap(make());
    r.publish('admin-1', true);
    expect(r.notifyAudience).toBe(true);
  });

  it('downgrade: PUBLISHED → DRAFT preserves lastPublishedAt; clears publishedById; resets notifyAudience', () => {
    const r = unwrap(make());
    r.publish('admin-1', true);
    const lastPub = r.lastPublishedAt;
    const res = r.downgradeToDraft();
    expect(res.success).toBe(true);
    expect(r.state).toBe('DRAFT');
    expect(r.publishedById).toBeNull();
    expect(r.notifyAudience).toBe(false);
    expect(r.lastPublishedAt).toEqual(lastPub);
  });

  it('downgrade: rejects when not Published', () => {
    const r = unwrap(make());
    const res = r.downgradeToDraft();
    expect(res.success).toBe(false);

    if (!res.success) {
      expect(res.error).toBe(ReportDomainCodes.REPORT_MUST_BE_PUBLISHED);
    }
  });

  it('archive: sets archivedAt', () => {
    const r = unwrap(make());
    const res = r.archive();
    expect(res.success).toBe(true);
    expect(r.archivedAt).not.toBeNull();
    expect(r.isArchived()).toBe(true);
  });

  it('archive: rejects double archive', () => {
    const r = unwrap(make());
    r.archive();
    const second = r.archive();
    expect(second.success).toBe(false);

    if (!second.success) {
      expect(second.error).toBe(ReportDomainCodes.REPORT_ALREADY_ARCHIVED);
    }
  });
});

describe('Report editing constraints', () => {
  it('updateTitle: allowed in Draft', () => {
    const r = unwrap(make());
    const res = r.updateTitle('New');
    expect(res.success).toBe(true);
    expect(r.title).toBe('New');
  });

  it('updateTitle: rejected in Published', () => {
    const r = unwrap(make());
    r.publish('admin-1', false);
    const res = r.updateTitle('New');
    expect(res.success).toBe(false);

    if (!res.success) {
      expect(res.error).toBe(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }
  });

  it('setVisibility: rejected in Published', () => {
    const r = unwrap(make());
    r.publish('admin-1', false);
    const res = r.setVisibility(ReportVisibility.PUBLIC_AUTH, []);
    expect(res.success).toBe(false);

    if (!res.success) {
      expect(res.error).toBe(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }
  });

  it('setVisibility: WITHIN_BOARDS requires boardIds', () => {
    const r = unwrap(make());
    const res = r.setVisibility(ReportVisibility.WITHIN_BOARDS, []);
    expect(res.success).toBe(false);

    if (!res.success) {
      expect(res.error).toBe(ReportDomainCodes.REPORT_BOARDS_EMPTY);
    }
  });

  it('setVisibility: switching away from WITHIN_BOARDS clears boardIds', () => {
    const r = unwrap(
      make({
        visibility: ReportVisibility.WITHIN_BOARDS,
        boardIds: ['b1'],
      })
    );
    const res = r.setVisibility(ReportVisibility.WITHIN_ORG_ONLY, []);
    expect(res.success).toBe(true);
    expect(r.boardIds).toEqual([]);
  });
});
