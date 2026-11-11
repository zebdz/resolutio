/** Legal-check persistence validates stored JSON and retains supplied identity/time. */
import { expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { LegalCheck } from '@/domain/ai/LegalCheck';
import {
  AIModelKey,
  legalAnalysisResultSchema,
} from '@/domain/ai/LegalAnalysis';
import { LegalCheckId, PollId, UserId } from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PrismaLegalCheckRepository } from '../PrismaLegalCheckRepository';
it('persists the assigned identity and timestamp for a new check', async () => {
  const creation = testCreation(LegalCheckId, 'check-1');
  const analysis = legalAnalysisResultSchema.parse({
    annotations: [],
    summary: {
      totalIssues: 0,
      overallRisk: 'low',
      recommendation: 'No issues',
    },
  });
  const result = LegalCheck.create(
    {
      pollId: PollId.parse('poll-1'),
      model: AIModelKey.parse('google'),
      ...analysis,
      checkedBy: UserId.parse('user-1'),
    },
    creation
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  const prisma = {
    pollLegalCheck: {
      upsert: vi.fn(async ({ create }) => ({ id: 'default', ...create })),
    },
  } as unknown as PrismaClient;
  const saved = await new PrismaLegalCheckRepository(prisma).upsert(
    result.value
  );
  expect(saved.id).toBe(creation.id);
  expect(saved.checkedAt.toISOString()).toBe(creation.now);
});
it('does not trust malformed persisted analysis JSON', async () => {
  const prisma = {
    pollLegalCheck: {
      findUnique: vi.fn(async () => ({
        id: 'check-1',
        pollId: 'poll-1',
        model: 'google',
        annotations: [{ questionId: '' }],
        summary: { totalIssues: 1, overallRisk: 'low', recommendation: 'Text' },
        overallRisk: 'low',
        totalIssues: 1,
        checkedBy: 'user-1',
        checkedAt: new Date('2026-01-01'),
        isStale: false,
      })),
    },
  } as unknown as PrismaClient;
  await expect(
    new PrismaLegalCheckRepository(prisma).findByPollId(PollId.parse('poll-1'))
  ).rejects.toThrow();
});
