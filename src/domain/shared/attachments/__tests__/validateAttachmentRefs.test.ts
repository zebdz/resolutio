/** Inline ownership checks distinguish validated namespaces and preserve foreign-reference failures. */
import { PollAttachmentId, ReportAttachmentId } from '../../EntityIds';
import { describe, it, expect } from 'vitest';
import { validateAttachmentRefs } from '../validateAttachmentRefs';

const POLLS = '/api/poll-attachments';
const CODE = 'domain.poll.descriptionInvalidAttachmentRef';

describe('validateAttachmentRefs', () => {
  it('succeeds when there are no refs', () => {
    const r = validateAttachmentRefs(
      'plain text',
      { apiPrefix: POLLS, ownIds: [] },
      CODE
    );
    expect(r.success).toBe(true);
  });

  it('succeeds when every ref belongs to the owner', () => {
    const text = '![a](/api/poll-attachments/abc123)';
    const r = validateAttachmentRefs(
      text,
      { apiPrefix: POLLS, ownIds: [PollAttachmentId.parse('abc123')] },
      CODE
    );
    expect(r.success).toBe(true);
  });

  it('fails when a ref does not belong to the owner', () => {
    const text = '![a](/api/poll-attachments/foreign999)';
    const r = validateAttachmentRefs(
      text,
      { apiPrefix: POLLS, ownIds: [PollAttachmentId.parse('abc123')] },
      CODE
    );
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(CODE);
  });

  it('fails when the owner has no attachments at all', () => {
    const text = '![a](/api/poll-attachments/abc123)';
    const r = validateAttachmentRefs(
      text,
      { apiPrefix: POLLS, ownIds: [] },
      CODE
    );
    expect(r.success).toBe(false);
  });
});

it('accepts report references only from the report owner list', () => {
  const scope = {
    apiPrefix: '/api/report-attachments' as const,
    ownIds: [ReportAttachmentId.parse('same-id')],
  };
  expect(
    validateAttachmentRefs(
      '[file](/api/report-attachments/same-id)',
      scope,
      CODE
    )
  ).toEqual({ success: true, value: undefined });
  expect(
    validateAttachmentRefs(
      '[file](/api/report-attachments/foreign)',
      scope,
      CODE
    )
  ).toEqual({ success: false, error: CODE });
});
it('accepts readonly ownership snapshots and checks every unique reference', () => {
  const ownIds = Object.freeze([PollAttachmentId.parse('own-id')]);
  expect(
    validateAttachmentRefs(
      '![a](/api/poll-attachments/own-id) [b](/api/poll-attachments/foreign)',
      { apiPrefix: POLLS, ownIds },
      CODE
    )
  ).toEqual({ success: false, error: CODE });
});
