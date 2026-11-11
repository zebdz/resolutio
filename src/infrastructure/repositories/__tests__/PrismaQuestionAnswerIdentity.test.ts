/** Question/answer adapters preserve the identity and time already assigned in core.
 * Database defaults must never replace these values during the first save. */
import { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
import { SortOrder } from '@/domain/poll/QuestionValues';
import { describe, expect, it, vi } from 'vitest';
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { Question } from '@/domain/poll/Question';
import { Answer } from '@/domain/poll/Answer';
import { AnswerId, QuestionId, PollId } from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PrismaQuestionRepository } from '../PrismaQuestionRepository';
import { PrismaAnswerRepository } from '../PrismaAnswerRepository';

describe('Question/answer creation persistence', () => {
  it('preserves question identity and creation time', async () => {
    const question = Question.create(
      QuestionText.parse('Choose'),
      PollId.parse('poll-1'),
      testCreation(QuestionId, 'question-1')
    );

    if (!question.success) {
      throw new Error(question.error);
    }

    const create = vi.fn(
      async ({ data }: { data: Prisma.QuestionUncheckedCreateInput }) => ({
        ...data,
        id: data.id ?? 'database-question',
        createdAt: data.createdAt ?? new Date(),
        archivedAt: null,
        answers: [],
      })
    );
    const repository = new PrismaQuestionRepository({
      question: { create },
    } as unknown as PrismaClient);
    const result = await repository.createQuestion(question.value);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.toJSON()).toEqual(question.value.toJSON());
    }
  });

  it('preserves answer identity and creation time', async () => {
    const answer = Answer.create(
      AnswerText.parse('Yes'),
      SortOrder.parse(0),
      QuestionId.parse('question-1'),
      testCreation(AnswerId, 'answer-1')
    );

    if (!answer.success) {
      throw new Error(answer.error);
    }

    const create = vi.fn(
      async ({ data }: { data: Prisma.AnswerUncheckedCreateInput }) => ({
        ...data,
        id: data.id ?? 'database-answer',
        createdAt: data.createdAt ?? new Date(),
        archivedAt: null,
      })
    );
    const repository = new PrismaAnswerRepository({
      answer: { create },
    } as unknown as PrismaClient);
    const result = await repository.createAnswer(answer.value);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.toJSON()).toEqual(answer.value.toJSON());
    }
  });
});
