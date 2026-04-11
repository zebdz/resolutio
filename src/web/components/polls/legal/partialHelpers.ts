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

  return {
    questionId: p.questionId,
    answerId: typeof p.answerId === 'string' ? p.answerId : null,
    severity: p.severity,
    issue: p.issue,
    explanation: typeof p.explanation === 'string' ? p.explanation : '',
    legalBasis: typeof p.legalBasis === 'string' ? p.legalBasis : '',
  };
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

  return {
    totalIssues: p.totalIssues,
    overallRisk: p.overallRisk,
    recommendation: p.recommendation,
  };
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
