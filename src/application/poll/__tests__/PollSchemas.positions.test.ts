/** Editing boundaries decode numeric text without accepting booleans, absence or fractions.
 * Every operation uses the same validated page/order units as the domain. */
import { expect, it } from 'vitest';
import {
  addQuestionSchema,
  addAnswerSchema,
  updateAnswerSchema,
  UpdateQuestionOrderSchema,
} from '../PollSchemas';

const checker = { containsProfanity: () => false, findProfaneWords: () => [] };
const question = {
  pollId: 'poll',
  text: 'Agree?',
  questionType: 'single-choice',
  answers: ['Yes'],
  page: 1,
  order: 0,
};

it.each([true, null, '', ' ', 1.5])(
  'rejects non-position input %j across editing operations',
  (value) => {
    expect(
      addQuestionSchema(checker).safeParse({ ...question, page: value }).success
    ).toBe(false);
    expect(
      addQuestionSchema(checker).safeParse({ ...question, order: value })
        .success
    ).toBe(false);
    expect(
      addAnswerSchema(checker).safeParse({
        questionId: 'question',
        text: 'Yes',
        order: value,
      }).success
    ).toBe(false);
    expect(
      updateAnswerSchema(checker).safeParse({
        answerId: 'answer',
        order: value,
      }).success
    ).toBe(false);
    expect(
      UpdateQuestionOrderSchema.safeParse({
        pollId: 'poll',
        updates: [{ questionId: 'question', page: 1, order: value }],
      }).success
    ).toBe(false);
  }
);

it('retains integer text decoding and zero-based sort order', () => {
  expect(
    addQuestionSchema(checker).parse({ ...question, page: '2', order: '0' })
  ).toMatchObject({ page: 2, order: 0 });
  expect(
    addAnswerSchema(checker).parse({
      questionId: 'question',
      text: 'Yes',
      order: '0',
    }).order
  ).toBe(0);
  expect(
    updateAnswerSchema(checker).parse({ answerId: 'answer' })
  ).not.toHaveProperty('order');
});
