import { QuestionId, PollId, UserId } from '@/domain/shared/EntityIds';
import { LegalIssueCount, AIModelKey } from '@/domain/ai/LegalAnalysis';
import { LegalCheckId } from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { describe, it, expect } from 'vitest';
import { LegalCheck } from '../LegalCheck';
import type {
  LegalAnnotation,
  LegalAnalysisSummary,
} from '@/application/ai/legalAnalysisSchema';

const sampleAnnotations: LegalAnnotation[] = [
  {
    questionId: QuestionId.parse('q-1'),
    answerId: null,
    severity: 'danger',
    issue: 'Discriminatory question',
    explanation: 'This question discriminates based on ethnicity.',
    legalBasis: 'Article 136 UK RF',
  },
];

const sampleSummary: LegalAnalysisSummary = {
  totalIssues: LegalIssueCount.parse(1),
  overallRisk: 'high',
  recommendation: 'Remove or rephrase discriminatory content.',
};

describe('LegalCheck', () => {
  describe('create', () => {
    it('should create a LegalCheck with valid data', () => {
      const result = LegalCheck.create(
        {
          pollId: PollId.parse('poll-1'),
          model: AIModelKey.parse('deepseek'),
          annotations: sampleAnnotations,
          summary: sampleSummary,
          checkedBy: UserId.parse('user-1'),
        },
        testCreation(LegalCheckId, 'check-1')
      );

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.pollId).toBe('poll-1');
        expect(result.value.model).toBe('deepseek');
        expect(result.value.annotations).toEqual(sampleAnnotations);
        expect(result.value.summary).toEqual(sampleSummary);
        expect(result.value.overallRisk).toBe('high');
        expect(result.value.totalIssues).toBe(1);
        expect(result.value.checkedBy).toBe('user-1');
        expect(result.value.checkedAt).toBeInstanceOf(Date);
      }
    });

    it('should fail if pollId is empty', () => {
      const result = LegalCheck.create(
        {
          // @ts-expect-error Deliberately invalid external input exercises runtime defense.
          pollId: '',
          model: AIModelKey.parse('deepseek'),
          annotations: sampleAnnotations,
          summary: sampleSummary,
          checkedBy: UserId.parse('user-1'),
        },
        testCreation(LegalCheckId, 'check-1')
      );

      expect(result.success).toBe(false);
    });

    it('should fail if checkedBy is empty', () => {
      const result = LegalCheck.create(
        {
          pollId: PollId.parse('poll-1'),
          model: AIModelKey.parse('deepseek'),
          annotations: sampleAnnotations,
          summary: sampleSummary,
          // @ts-expect-error Deliberately invalid external input exercises runtime defense.
          checkedBy: '',
        },
        testCreation(LegalCheckId, 'check-1')
      );

      expect(result.success).toBe(false);
    });

    it('should handle empty annotations (no issues found)', () => {
      const result = LegalCheck.create(
        {
          pollId: PollId.parse('poll-1'),
          model: AIModelKey.parse('deepseek'),
          annotations: [],
          summary: {
            totalIssues: LegalIssueCount.parse(0),
            overallRisk: 'low',
            recommendation: 'No issues found.',
          },
          checkedBy: UserId.parse('user-1'),
        },
        testCreation(LegalCheckId, 'check-1')
      );

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.totalIssues).toBe(0);
        expect(result.value.overallRisk).toBe('low');
      }
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from DB data', () => {
      const check = LegalCheck.reconstitute({
        id: 'lc-1',
        pollId: 'poll-1',
        model: 'deepseek',
        annotations: sampleAnnotations,
        summary: sampleSummary,
        overallRisk: 'high',
        totalIssues: 1,
        checkedBy: 'user-1',
        checkedAt: new Date('2026-04-05'),
      });

      expect(check.id).toBe('lc-1');
      expect(check.pollId).toBe('poll-1');
      expect(check.annotations).toEqual(sampleAnnotations);
    });
  });

  describe('toJSON', () => {
    it('should serialize to plain object', () => {
      const check = LegalCheck.reconstitute({
        id: 'lc-1',
        pollId: 'poll-1',
        model: 'deepseek',
        annotations: sampleAnnotations,
        summary: sampleSummary,
        overallRisk: 'high',
        totalIssues: 1,
        checkedBy: 'user-1',
        checkedAt: new Date('2026-04-05'),
      });

      const json = check.toJSON();
      expect(json.id).toBe('lc-1');
      expect(json.pollId).toBe('poll-1');
      expect(json.annotations).toEqual(sampleAnnotations);
      expect(json.summary).toEqual(sampleSummary);
    });
  });
});
