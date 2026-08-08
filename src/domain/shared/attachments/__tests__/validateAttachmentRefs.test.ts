import { describe, it, expect } from 'vitest';
import { validateAttachmentRefs } from '../validateAttachmentRefs';

const POLLS = '/api/poll-attachments';
const CODE = 'domain.poll.descriptionInvalidAttachmentRef';

describe('validateAttachmentRefs', () => {
  it('succeeds when there are no refs', () => {
    const r = validateAttachmentRefs('plain text', POLLS, [], CODE);
    expect(r.success).toBe(true);
  });

  it('succeeds when every ref belongs to the owner', () => {
    const text = '![a](/api/poll-attachments/abc123)';
    const r = validateAttachmentRefs(text, POLLS, ['abc123'], CODE);
    expect(r.success).toBe(true);
  });

  it('fails when a ref does not belong to the owner', () => {
    const text = '![a](/api/poll-attachments/foreign999)';
    const r = validateAttachmentRefs(text, POLLS, ['abc123'], CODE);
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(CODE);
  });

  it('fails when the owner has no attachments at all', () => {
    const text = '![a](/api/poll-attachments/abc123)';
    const r = validateAttachmentRefs(text, POLLS, [], CODE);
    expect(r.success).toBe(false);
  });
});
