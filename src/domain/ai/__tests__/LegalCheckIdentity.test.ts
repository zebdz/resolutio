/** Legal analysis loading validates counts, identities and summary consistency. */
import { expect, it } from 'vitest';
import { LegalCheck } from '../LegalCheck';
import { LegalCheckId, PollId, UserId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { AIModelKey, legalAnalysisResultSchema } from '../LegalAnalysis';

const data = {
  id: 'check-1',
  pollId: 'poll-1',
  model: 'google',
  annotations: [],
  summary: {
    totalIssues: 0,
    overallRisk: 'low' as const,
    recommendation: 'No issues',
  },
  overallRisk: 'low' as const,
  totalIssues: 0,
  checkedBy: 'user-1',
  checkedAt: new Date('2026-01-01'),
};
it('rejects noninteger issue counts when loading stored analysis', () => {
  expect(() =>
    LegalCheck.reconstitute({
      ...data,
      totalIssues: NaN,
      summary: { ...data.summary, totalIssues: NaN },
    })
  ).toThrow();
});
it('uses the identity and time supplied before analysis persistence', () => {
  const creation = testCreation(LegalCheckId, 'assigned-check');
  const analysis = legalAnalysisResultSchema.parse(data);
  const result = LegalCheck.create(
    {
      pollId: PollId.parse('poll-1'),
      model: AIModelKey.parse('google'),
      ...analysis,
      checkedBy: UserId.parse('user-1'),
    },
    creation
  );
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(result.value.id).toBe(creation.id);
  expect(result.value.checkedAt.toISOString()).toBe(creation.now);
});
