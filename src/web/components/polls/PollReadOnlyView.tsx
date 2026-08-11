'use client';

import { useTranslations } from 'next-intl';
import { MarkdownRenderer } from '@/web/components/markdown/MarkdownRenderer';
import { POLL_ATTACHMENT_API_PREFIX } from '@/domain/poll/PollAttachment';
import { LegalAnnotation } from '@/src/web/components/polls/legal/LegalAnnotation';
import type { LegalAnnotation as LegalAnnotationType } from '@/application/ai/legalAnalysisSchema';

interface ReadOnlyAnswer {
  id: string;
  text: string;
}

interface ReadOnlyQuestion {
  id: string;
  text: string;
  details?: string;
  page: number;
  order: number;
  answers?: ReadOnlyAnswer[];
}

interface PollReadOnlyViewProps {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  pollType: string;
  attachmentIds: string[];
  questions: ReadOnlyQuestion[];
  annotations: LegalAnnotationType[];
}

/**
 * The poll as an admin who cannot edit it sees it: every question on one page,
 * with its legal annotations attached.
 *
 * The editor shows one question at a time because the author is working on
 * one. A reader is reviewing the whole ballot — usually against the legality
 * summary, whose links jump to the annotation anchors — so hiding the rest
 * behind a sidebar would only get in the way.
 */
export function PollReadOnlyView({
  title,
  description,
  startDate,
  endDate,
  pollType,
  attachmentIds,
  questions,
  annotations,
}: PollReadOnlyViewProps) {
  const t = useTranslations('poll');

  const ordered = [...questions].sort(
    (a, b) => a.page - b.page || a.order - b.order
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('type.label')}:{' '}
          {pollType === 'OPEN' ? t('type.open') : t('type.organization')}
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>

        <div className="flex flex-wrap gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          <span>
            {t('startDate')}: {startDate}
          </span>
          <span>
            {t('endDate')}: {endDate}
          </span>
        </div>

        {description && (
          <div className="text-zinc-600 dark:text-zinc-400">
            <MarkdownRenderer
              source={description}
              apiPrefix={POLL_ATTACHMENT_API_PREFIX}
              allowedAttachmentIds={attachmentIds}
            />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
          {t('questions')}
        </h3>

        {ordered.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            {t('noQuestions')}
          </div>
        ) : (
          ordered.map((question, index) => (
            <div
              key={question.id}
              className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {index + 1}. {question.text}
              </p>

              {question.details && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {question.details}
                </p>
              )}

              <ul className="mt-3 space-y-1">
                {(question.answers ?? []).map((answer) => (
                  <li
                    key={answer.id}
                    className="text-sm text-zinc-600 dark:text-zinc-400"
                  >
                    • {answer.text}
                  </li>
                ))}
              </ul>

              {annotations
                .filter((a) => a.questionId === question.id)
                .map((annotation, annotationIndex) => (
                  <LegalAnnotation
                    key={`${annotation.questionId}-${annotation.answerId ?? 'q'}-${annotationIndex}`}
                    annotation={annotation}
                  />
                ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
