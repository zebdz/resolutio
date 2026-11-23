/** Question multipart decoding exercises the production parser, including legacy JSON fallbacks.
 * These checks preserve answer order and trimming without a copied parser implementation. */
import { describe, it, expect } from 'vitest';
import { readQuestionForm } from '../poll/PollFormData';

describe('question form decoding', () => {
  it('trims nonempty answers and preserves their submitted order', () => {
    const form = new FormData();
    form.set(
      'answers',
      JSON.stringify([' Second ', ' ', 'First', '', 'Third '])
    );
    expect(readQuestionForm(form).answers).toEqual([
      'Second',
      'First',
      'Third',
    ]);
  });

  it.each([undefined, '', '[broken', '{}', '["Valid",1]'])(
    'retains the empty-answer validation outcome for %j',
    (value) => {
      const form = new FormData();

      if (value !== undefined) {
        form.set('answers', value);
      }

      expect(readQuestionForm(form).answers).toEqual([]);
    }
  );

  it('does not treat an uploaded file as answer JSON', () => {
    const form = new FormData();
    form.set('answers', new Blob(['["Yes"]']), 'answers.json');
    expect(readQuestionForm(form).answers).toEqual([]);
  });

  it('treats whitespace-only optional details as absent', () => {
    const form = new FormData();
    form.set('details', '  ');
    expect(readQuestionForm(form).details).toBeUndefined();
  });
});
