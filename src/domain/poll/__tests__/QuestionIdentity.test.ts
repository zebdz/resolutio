import { AnswerText, QuestionText } from '@/domain/poll/QuestionValues';
import { SortOrder } from '@/domain/poll/QuestionValues';
import { PageNumber } from '../QuestionValues';
/** Question clients exercise validated identities, positions and aggregate ownership.
 * Persistence and public dates must not bypass these invariants. */
import { describe, expect, it } from 'vitest';
import { Question } from '../Question';
import { Answer } from '../Answer';
import { AnswerId, QuestionId, PollId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { Instant } from '../../shared/Instant';
import { PollDomainCodes } from '../PollDomainCodes';

const persistedQuestion = () => ({
  id: 'question-1',
  text: 'Choose',
  details: null,
  pollId: 'poll-1',
  page: 1,
  order: 0,
  questionType: 'single-choice',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  archivedAt: null,
  answers: [],
});

function answer(questionId = 'question-1') {
  const result = Answer.create(
    AnswerText.parse('Yes'),
    SortOrder.parse(0),
    QuestionId.parse(questionId),
    testCreation(AnswerId, 'answer-1')
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.value;
}

describe('Question identity and lifecycle', () => {
  it.each([
    { id: '' },
    { pollId: '' },
    { text: '' },
    { text: ' Choose ' },
    { text: 'x'.repeat(501) },
    { details: ' Details ' },
    { details: '' },
    { details: 'x'.repeat(501) },
    { page: NaN },
    { page: 1.5 },
    { order: Infinity },
    { questionType: 'unknown' },
    { createdAt: new Date(NaN) },
    { archivedAt: new Date(NaN) },
  ])('rejects invalid persisted questions: %j', (invalid) => {
    expect(() =>
      Question.reconstitute({ ...persistedQuestion(), ...invalid })
    ).toThrow(PollDomainCodes.QUESTION_INVALID_DATA);
  });

  it('rejects answers owned by another question and duplicate answer identities', () => {
    const question = Question.reconstitute(persistedQuestion());
    const foreign = answer('question-other');
    expect(question.addAnswer(foreign)).toEqual({
      success: false,
      error: PollDomainCodes.QUESTION_INVALID_DATA,
    });
    expect(() =>
      Question.reconstitute({ ...persistedQuestion(), answers: [foreign] })
    ).toThrow(PollDomainCodes.QUESTION_INVALID_DATA);
    const own = answer();
    expect(question.addAnswer(own).success).toBe(true);
    expect(question.addAnswer(own)).toEqual({
      success: false,
      error: PollDomainCodes.QUESTION_INVALID_DATA,
    });
    expect(() =>
      Question.reconstitute({ ...persistedQuestion(), answers: [own, own] })
    ).toThrow(PollDomainCodes.QUESTION_INVALID_DATA);
  });

  it('copies exposed dates and archives its answer at supplied time', () => {
    const data = persistedQuestion();
    const own = answer();
    const question = Question.reconstitute({ ...data, answers: [own] });
    data.createdAt.setFullYear(1999);
    question.createdAt.setFullYear(1998);
    const at = Instant.parse('2026-01-02T00:00:00.000Z');
    expect(question.removeAnswer(own.id, at).success).toBe(true);
    expect(question.answers[0].archivedAt?.toISOString()).toBe(at);
    expect(question.archive(at).success).toBe(true);
    question.toJSON().archivedAt?.setFullYear(1997);
    expect(question.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(question.archivedAt?.toISOString()).toBe(at);
  });
  it.each([NaN, Infinity, -Infinity, 0, -1, 1.5])(
    'rejects invalid page %s on creation and update',
    (page) => {
      const creation = testCreation(QuestionId, 'question-1');
      const pollId = PollId.parse('poll-1');
      expect(
        Question.create(
          QuestionText.parse('Choose'),
          pollId,
          creation,
          // @ts-expect-error Exercise runtime rejection of malformed caller input.
          page
        )
      ).toEqual({
        success: false,
        error: PollDomainCodes.QUESTION_INVALID_PAGE,
      });
      const result = Question.create(
        QuestionText.parse('Choose'),
        pollId,
        creation
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // @ts-expect-error Exercise runtime rejection of malformed caller input.
      expect(result.value.updatePage(page)).toEqual({
        success: false,
        error: PollDomainCodes.QUESTION_INVALID_PAGE,
      });
      expect(result.value.page).toBe(1);
    }
  );

  it.each([NaN, Infinity, -Infinity, -1, 0.5])(
    'rejects invalid order %s on creation and update',
    (order) => {
      const creation = testCreation(QuestionId, 'question-1');
      const pollId = PollId.parse('poll-1');
      expect(
        Question.create(
          QuestionText.parse('Choose'),
          pollId,
          creation,
          PageNumber.parse(1),
          // @ts-expect-error Exercise runtime rejection of malformed caller input.
          order
        )
      ).toEqual({
        success: false,
        error: PollDomainCodes.QUESTION_INVALID_ORDER,
      });
      const result = Question.create(
        QuestionText.parse('Choose'),
        pollId,
        creation
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // @ts-expect-error Exercise runtime rejection of malformed caller input.
      expect(result.value.updateOrder(order)).toEqual({
        success: false,
        error: PollDomainCodes.QUESTION_INVALID_ORDER,
      });
      expect(result.value.order).toBe(0);
    }
  );
  it('uses supplied identity/time before any persistence', () => {
    const creation = testCreation(QuestionId, 'question-1');
    const result = Question.create(
      QuestionText.parse('Choose'),
      PollId.parse('poll-1'),
      creation
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.id).toBe(creation.id);
      expect(result.value.createdAt).toEqual(Instant.toDate(creation.now));
    }
  });
});
