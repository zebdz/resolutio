import { describe, it, expect } from 'vitest';
import {
  hasLegalRelevantChanges,
  type LegalRelevantContent,
} from '../hasLegalRelevantChanges';

const base: LegalRelevantContent = {
  title: 'Test Poll',
  description: 'A test poll',
  questions: [
    {
      id: 'q1',
      text: 'Do you agree?',
      answers: [
        { id: 'a1', text: 'Yes' },
        { id: 'a2', text: 'No' },
      ],
    },
  ],
};

function clone(content: LegalRelevantContent): LegalRelevantContent {
  return JSON.parse(JSON.stringify(content));
}

describe('hasLegalRelevantChanges', () => {
  it('returns false when nothing changed', () => {
    expect(hasLegalRelevantChanges(base, clone(base))).toBe(false);
  });

  it('returns true when title changed', () => {
    const current = clone(base);
    current.title = 'New Title';
    expect(hasLegalRelevantChanges(base, current)).toBe(true);
  });

  it('returns true when description changed', () => {
    const current = clone(base);
    current.description = 'New description';
    expect(hasLegalRelevantChanges(base, current)).toBe(true);
  });

  it('returns true when question text changed', () => {
    const current = clone(base);
    current.questions[0].text = 'Updated question?';
    expect(hasLegalRelevantChanges(base, current)).toBe(true);
  });

  it('returns true when answer text changed', () => {
    const current = clone(base);
    current.questions[0].answers[1].text = 'Maybe';
    expect(hasLegalRelevantChanges(base, current)).toBe(true);
  });

  it('returns true when question added', () => {
    const current = clone(base);
    current.questions.push({
      id: 'q2',
      text: 'New question',
      answers: [{ id: 'a3', text: 'Option' }],
    });
    expect(hasLegalRelevantChanges(base, current)).toBe(true);
  });

  it('returns true when question removed', () => {
    const current = clone(base);
    current.questions = [];
    expect(hasLegalRelevantChanges(base, current)).toBe(true);
  });

  it('returns true when answer added', () => {
    const current = clone(base);
    current.questions[0].answers.push({ id: 'a3', text: 'Maybe' });
    expect(hasLegalRelevantChanges(base, current)).toBe(true);
  });

  it('returns true when answer removed', () => {
    const current = clone(base);
    current.questions[0].answers = [current.questions[0].answers[0]];
    expect(hasLegalRelevantChanges(base, current)).toBe(true);
  });
});
