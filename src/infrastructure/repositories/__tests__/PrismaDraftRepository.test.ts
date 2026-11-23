/** Draft persistence keeps application-assigned identity/time on creation.
 * Repeated selections refresh the existing row without replacing its identity. */
import { describe, expect, it, vi } from 'vitest';
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { VoteDraft } from '@/domain/poll/VoteDraft';
import {
  PollId,
  QuestionId,
  AnswerId,
  UserId,
  VoteDraftId,
} from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { Instant } from '@/domain/shared/Instant';
import { PrismaDraftRepository } from '../PrismaDraftRepository';

function draft() {
  const created = VoteDraft.create(
    PollId.parse('poll-1'),
    QuestionId.parse('question-1'),
    AnswerId.parse('answer-1'),
    UserId.parse('user-1'),
    testCreation(VoteDraftId, 'draft-1')
  );

  if (!created.success) {
    throw new Error(created.error);
  }

  return created.value;
}

describe('PrismaDraftRepository identity', () => {
  it('refreshes a repeated selection without changing its original identity or creation time', async () => {
    const entity = draft();
    const at = Instant.parse('2026-01-02T00:00:00.000Z');
    entity.touch(at);
    const existing = {
      id: 'existing-draft',
      pollId: entity.pollId,
      questionId: entity.questionId,
      answerId: entity.answerId,
      userId: entity.userId,
      createdAt: new Date('2025-12-31T00:00:00.000Z'),
      updatedAt: entity.createdAt,
    };
    const upsert = vi.fn(
      async ({ update }: { update: Prisma.VoteDraftUncheckedUpdateInput }) => ({
        ...existing,
        ...update,
      })
    );
    const repo = new PrismaDraftRepository({
      voteDraft: { upsert },
    } as unknown as PrismaClient);
    const saved = await repo.saveDraft(entity);
    expect(saved.success).toBe(true);

    if (saved.success) {
      expect(saved.value.id).toBe(existing.id);
      expect(saved.value.createdAt).toEqual(existing.createdAt);
      expect(saved.value.updatedAt.toISOString()).toBe(at);
    }
  });
  it('persists the supplied identity and creation instant', async () => {
    const entity = draft();
    const upsert = vi.fn(
      async ({ create }: { create: Prisma.VoteDraftUncheckedCreateInput }) => ({
        ...create,
        id: create.id ?? 'database-draft',
        createdAt: create.createdAt ?? new Date(),
        updatedAt: create.updatedAt ?? new Date(),
      })
    );
    const repo = new PrismaDraftRepository({
      voteDraft: { upsert },
    } as unknown as PrismaClient);
    const saved = await repo.saveDraft(entity);
    expect(saved.success).toBe(true);

    if (saved.success) {
      expect(saved.value.id).toBe(entity.id);
      expect(saved.value.createdAt).toEqual(entity.createdAt);
      expect(saved.value.updatedAt).toEqual(entity.updatedAt);
    }
  });
});
