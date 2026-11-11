/** Answer client tests protect explicit identity/time and validated persisted data.
 * These invariants keep repository round trips from inventing or corrupting answers. */
import { AnswerText } from '@/domain/poll/QuestionValues';
import { SortOrder } from '@/domain/poll/QuestionValues';
import { describe, expect, it } from 'vitest';
import { Answer } from '../Answer';
import { AnswerId, QuestionId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { Instant } from '../../shared/Instant';
import { PollDomainCodes } from '../PollDomainCodes';

describe('Answer identity and lifecycle', () => {
  it.each([
    { id: '' },
    { questionId: '' },
    { text: '' },
    { text: ' Yes ' },
    { text: 'x'.repeat(501) },
    { order: NaN },
    { order: 0.5 },
    { createdAt: new Date(NaN) },
    { archivedAt: new Date(NaN) },
  ])('rejects invalid persisted answers: %j', (invalid) => {
    expect(() =>
      Answer.reconstitute({
        id: 'answer-1',
        text: 'Yes',
        order: 0,
        questionId: 'question-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        archivedAt: null,
        ...invalid,
      })
    ).toThrow(PollDomainCodes.ANSWER_INVALID_DATA);
  });

  it('copies persisted and exposed dates and archives at supplied time', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const answer = Answer.reconstitute({
      id: 'answer-1',
      text: 'Yes',
      order: 0,
      questionId: 'question-1',
      createdAt,
      archivedAt: null,
    });
    createdAt.setFullYear(1999);
    answer.createdAt.setFullYear(1998);
    const at = Instant.parse('2026-01-02T00:00:00.000Z');
    expect(answer.archive(at).success).toBe(true);
    answer.toJSON().archivedAt?.setFullYear(1997);
    expect(answer.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(answer.archivedAt?.toISOString()).toBe(at);
  });
  it.each([NaN, Infinity, -Infinity, -1, 0.5])(
    'rejects invalid order %s on creation and update',
    (order) => {
      const creation = testCreation(AnswerId, 'answer-1');
      const questionId = QuestionId.parse('question-1');
      expect(
        Answer.create(
          AnswerText.parse('Yes'),
          // @ts-expect-error Exercise runtime rejection of malformed caller input.
          order,
          questionId,
          creation
        )
      ).toEqual({
        success: false,
        error: PollDomainCodes.ANSWER_INVALID_ORDER,
      });
      const result = Answer.create(
        AnswerText.parse('Yes'),
        SortOrder.parse(0),
        questionId,
        creation
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // @ts-expect-error Exercise runtime rejection of malformed caller input.
      expect(result.value.updateOrder(order)).toEqual({
        success: false,
        error: PollDomainCodes.ANSWER_INVALID_ORDER,
      });
      expect(result.value.order).toBe(0);
    }
  );
  it('keeps the identity and creation time supplied by its caller', () => {
    const creation = testCreation(AnswerId, 'answer-1');
    const result = Answer.create(
      AnswerText.parse('Yes'),
      SortOrder.parse(0),
      QuestionId.parse('question-1'),
      creation
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.id).toBe(creation.id);
      expect(result.value.createdAt).toEqual(Instant.toDate(creation.now));
    }
  });
});
