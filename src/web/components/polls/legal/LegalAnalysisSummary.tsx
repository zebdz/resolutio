'use client';

import { useTranslations } from 'next-intl';
import type {
  LegalAnnotation,
  LegalAnalysisSummary as SummaryType,
} from '@/application/ai/legalAnalysisSchema';
import { getAIModelInfo } from '@/application/ai/modelRegistry';

interface LegalAnalysisSummaryProps {
  summary: SummaryType;
  annotations: LegalAnnotation[];
  model: string;
  checkedAt?: Date;
}

const riskBadgeColors: Record<SummaryType['overallRisk'], string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const riskBorderColors: Record<SummaryType['overallRisk'], string> = {
  low: 'border-green-200 dark:border-green-800',
  medium: 'border-yellow-200 dark:border-yellow-800',
  high: 'border-red-200 dark:border-red-800',
};

export function LegalAnalysisSummary({
  summary,
  annotations,
  model,
  checkedAt,
}: LegalAnalysisSummaryProps) {
  const t = useTranslations('legalCheck');

  const scrollToAnnotation = (annotation: LegalAnnotation) => {
    const anchorId = annotation.answerId
      ? `legal-a-${annotation.answerId}`
      : `legal-q-${annotation.questionId}`;
    const element = document.getElementById(anchorId);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div
      className={`space-y-4 rounded-lg border bg-white p-6 dark:bg-zinc-900 ${riskBorderColors[summary.overallRisk]}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t('summary.title')}
        </h3>
        <span
          className={`inline-flex self-start items-center rounded-md px-3 py-1 text-sm font-medium ${riskBadgeColors[summary.overallRisk]}`}
        >
          {t(`risk.${summary.overallRisk}`)}
        </span>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {t('summary.issues', { count: summary.totalIssues })}
      </p>

      {summary.totalIssues === 0 ? (
        <p className="text-sm text-green-700 dark:text-green-300">
          {t('summary.noIssues')}
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('summary.recommendation')}:
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {summary.recommendation}
            </p>
          </div>

          <div className="space-y-1">
            {annotations.map((annotation, index) => {
              const isDanger = annotation.severity === 'danger';

              return (
                <button
                  type="button"
                  key={`${annotation.questionId}-${annotation.answerId ?? 'q'}-${index}`}
                  onClick={() => scrollToAnnotation(annotation)}
                  className={`block w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-opacity hover:opacity-80 ${
                    isDanger
                      ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                      : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                  }`}
                >
                  {annotation.issue}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500">
        <span>
          {t('summary.checkedWith', {
            model: getAIModelInfo(model)?.displayName ?? model,
          })}
        </span>
        {checkedAt && (
          <span>
            {t('summary.checkedAt', { date: checkedAt.toLocaleString() })}
          </span>
        )}
      </div>
    </div>
  );
}
