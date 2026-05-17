import { getTranslations, getFormatter } from 'next-intl/server';
import { Link } from '@/src/i18n/routing';
import { Heading } from '@/web/components/catalyst/heading';
import { User } from '@/domain/user/User';
import type { SerializedReport } from '@/web/actions/report/report';
import { ReportStateBadge } from './ReportStateBadge';
import { ReportMarkdownRenderer } from './ReportMarkdownRenderer';
import { ReportAdminActions } from './ReportAdminActions';

interface ReportDetailProps {
  report: SerializedReport;
  author: {
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  polls: Array<{
    id: string;
    title: string;
    state: string;
    archivedAt: string | null;
  }>;
  viewer: {
    id: string;
    isAuthor: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  } | null;
}

export async function ReportDetail({
  report,
  author,
  attachments,
  polls,
  viewer,
}: ReportDetailProps) {
  const t = await getTranslations('report');
  const format = await getFormatter();

  const authorName = User.formatFullName(
    author.firstName,
    author.lastName,
    author.middleName
  );

  const dateStr = report.lastPublishedAt ?? report.createdAt;
  const dateFormatted = format.dateTime(new Date(dateStr), {
    dateStyle: 'medium',
  });
  const dateLabel = report.lastPublishedAt
    ? t('detail.publishedDate', { date: dateFormatted })
    : t('detail.createdDate', { date: dateFormatted });

  const isArchived = !!report.archivedAt;
  const canManage =
    viewer !== null &&
    (viewer.isAuthor || viewer.isAdmin || viewer.isSuperAdmin) &&
    !isArchived;

  const pdfAttachments = attachments.filter(
    (a) => a.mimeType === 'application/pdf'
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-start gap-3">
          <Heading level={1}>{report.title}</Heading>
          <div className="mt-1">
            <ReportStateBadge
              state={report.state as 'DRAFT' | 'PUBLISHED'}
              archived={isArchived}
            />
          </div>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {authorName} &middot; {dateLabel}
        </p>
      </div>

      {/* Admin actions */}
      {canManage && viewer && (
        <div className="flex flex-wrap items-center gap-3">
          {report.state === 'DRAFT' &&
            (viewer.isAuthor || viewer.isAdmin || viewer.isSuperAdmin) && (
              <Link
                href={`/reports/${report.id}/edit`}
                className="cursor-pointer text-sm font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
              >
                {t('detail.editButton')}
              </Link>
            )}
          <ReportAdminActions
            report={{
              id: report.id,
              state: report.state as 'DRAFT' | 'PUBLISHED',
            }}
            canPublish={viewer.isAdmin || viewer.isSuperAdmin}
            canEdit={viewer.isAuthor || viewer.isAdmin || viewer.isSuperAdmin}
          />
        </div>
      )}

      {/* Body */}
      <div className="prose prose-zinc max-w-none dark:prose-invert">
        <ReportMarkdownRenderer source={report.body} />
      </div>

      {/* PDF attachments */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          {t('detail.attachmentsHeader')}
        </h2>
        {pdfAttachments.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('detail.noAttachments')}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {pdfAttachments.map((att) => (
              <li
                key={att.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {att.fileName}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {(att.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <a
                  href={`/api/report-attachments/${att.id}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="ml-4 cursor-pointer text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  {t('detail.openFile')}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Polls */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          {t('detail.pollsHeader')}
        </h2>
        {polls.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('detail.noPolls')}
          </p>
        ) : (
          <ul className="space-y-2">
            {polls.map((poll) => {
              const archived = poll.archivedAt !== null;

              return (
                <li key={poll.id}>
                  <Link
                    href={`/polls/${poll.id}`}
                    className={[
                      'cursor-pointer text-sm hover:underline',
                      archived
                        ? 'opacity-60 line-through text-zinc-500 dark:text-zinc-400'
                        : 'text-zinc-800 dark:text-zinc-200',
                    ].join(' ')}
                  >
                    {poll.title}
                    {archived && (
                      <span className="ml-1">{t('polls.archivedSuffix')}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
