/** Completes displayable streaming records while validating their IDs and counts.
 * Missing explanatory prose keeps its existing empty-string presentation fallback. */
import {
  legalAnnotationSchema,
  legalAnalysisSummarySchema,
} from '@/domain/ai/LegalAnalysis';
import type {
  LegalAnnotation,
  LegalAnalysisSummary,
} from '@/application/ai/legalAnalysisSchema';

export function tryCompleteAnnotation(
  partial: unknown
): LegalAnnotation | null {
  if (!partial || typeof partial !== 'object') {
    return null;
  }

  const p = partial as Record<string, unknown>;

  if (typeof p.questionId !== 'string') {
    return null;
  }

  if (p.severity !== 'warning' && p.severity !== 'danger') {
    return null;
  }

  if (typeof p.issue !== 'string') {
    return null;
  }

  const parsed = legalAnnotationSchema.safeParse({
    questionId: p.questionId,
    answerId: typeof p.answerId === 'string' ? p.answerId : null,
    severity: p.severity,
    issue: p.issue,
    explanation: typeof p.explanation === 'string' ? p.explanation : '',
    legalBasis: typeof p.legalBasis === 'string' ? p.legalBasis : '',
  });

  return parsed.success ? parsed.data : null;
}

export function tryCompleteSummary(
  partial: unknown
): LegalAnalysisSummary | null {
  if (!partial || typeof partial !== 'object') {
    return null;
  }

  const p = partial as Record<string, unknown>;

  if (typeof p.totalIssues !== 'number') {
    return null;
  }

  if (
    p.overallRisk !== 'low' &&
    p.overallRisk !== 'medium' &&
    p.overallRisk !== 'high'
  ) {
    return null;
  }

  if (typeof p.recommendation !== 'string') {
    return null;
  }

  const parsed = legalAnalysisSummarySchema.safeParse({
    totalIssues: p.totalIssues,
    overallRisk: p.overallRisk,
    recommendation: p.recommendation,
  });

  return parsed.success ? parsed.data : null;
}

export function completeAnnotationsFromPartial(
  partialAnnotations: unknown
): LegalAnnotation[] {
  if (!Array.isArray(partialAnnotations)) {
    return [];
  }

  const result: LegalAnnotation[] = [];

  for (const entry of partialAnnotations) {
    const complete = tryCompleteAnnotation(entry);

    if (complete) {
      result.push(complete);
    }
  }

  return result;
}
