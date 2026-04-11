'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LegalAnnotation as LegalAnnotationType } from '@/application/ai/legalAnalysisSchema';

interface LegalAnnotationProps {
  annotation: LegalAnnotationType;
}

export function LegalAnnotation({ annotation }: LegalAnnotationProps) {
  const t = useTranslations('legalCheck');
  const [expanded, setExpanded] = useState(false);

  const isDanger = annotation.severity === 'danger';
  const bgColor = isDanger
    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  const badgeColor = isDanger
    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  const textColor = isDanger
    ? 'text-red-800 dark:text-red-200'
    : 'text-yellow-800 dark:text-yellow-200';

  const anchorId = annotation.answerId
    ? `legal-a-${annotation.answerId}`
    : `legal-q-${annotation.questionId}`;

  return (
    <div id={anchorId} className={`mt-2 rounded-lg border p-3 ${bgColor}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${badgeColor}`}
          >
            {t(`severity.${annotation.severity}`)}
          </span>
          <span className={`text-sm font-medium ${textColor}`}>
            {annotation.issue}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`cursor-pointer self-start text-xs underline hover:opacity-80 ${textColor}`}
        >
          {expanded ? t('annotation.hideDetails') : t('annotation.showDetails')}
        </button>
      </div>

      {expanded && (
        <div className={`mt-2 space-y-1 text-sm ${textColor}`}>
          <p>{annotation.explanation}</p>
          <p className="font-medium">
            {t('annotation.legalBasis')}: {annotation.legalBasis}
          </p>
        </div>
      )}
    </div>
  );
}
