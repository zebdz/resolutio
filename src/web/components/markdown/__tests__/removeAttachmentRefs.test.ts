import { describe, it, expect } from 'vitest';
import { removeAttachmentRefs } from '../removeAttachmentRefs';

const POLLS = '/api/poll-attachments';

describe('removeAttachmentRefs', () => {
  it('removes an image ref for the given attachment', () => {
    const out = removeAttachmentRefs(
      'Before ![photo](/api/poll-attachments/abc123) after',
      POLLS,
      'abc123'
    );

    expect(out).not.toContain('abc123');
    expect(out).toContain('Before');
    expect(out).toContain('after');
  });

  it('removes a link ref for the given attachment', () => {
    const out = removeAttachmentRefs(
      'See [survey.pdf](/api/poll-attachments/def456) please',
      POLLS,
      'def456'
    );

    expect(out).not.toContain('def456');
    expect(out).not.toContain('survey.pdf');
  });

  it('removes every occurrence of the same ref', () => {
    const out = removeAttachmentRefs(
      '![a](/api/poll-attachments/x1) middle ![a](/api/poll-attachments/x1)',
      POLLS,
      'x1'
    );

    expect(out).not.toContain('x1');
  });

  // The whole point: other attachments must survive, or removing one file
  // would silently strip the rest of the evidence from the description.
  it('leaves refs to other attachments alone', () => {
    const out = removeAttachmentRefs(
      '![a](/api/poll-attachments/keep1) and ![b](/api/poll-attachments/drop1)',
      POLLS,
      'drop1'
    );

    expect(out).toContain('/api/poll-attachments/keep1');
    expect(out).not.toContain('drop1');
  });

  // Ids are cuid-like and can share a prefix; a substring match would take
  // the wrong one down with it.
  it('does not remove an id that merely starts with the target id', () => {
    const out = removeAttachmentRefs(
      '![a](/api/poll-attachments/abc123extra)',
      POLLS,
      'abc123'
    );

    expect(out).toContain('abc123extra');
  });

  it('leaves refs belonging to another aggregate alone', () => {
    const out = removeAttachmentRefs(
      '![a](/api/report-attachments/abc123)',
      POLLS,
      'abc123'
    );

    expect(out).toContain('/api/report-attachments/abc123');
  });

  it('returns the text unchanged when the ref is absent', () => {
    expect(removeAttachmentRefs('plain text', POLLS, 'nope')).toBe(
      'plain text'
    );
  });

  it('collapses the blank lines the ref left behind', () => {
    const out = removeAttachmentRefs(
      'One\n\n![a](/api/poll-attachments/x1)\n\nTwo',
      POLLS,
      'x1'
    );

    expect(out).toBe('One\n\nTwo');
  });
});
