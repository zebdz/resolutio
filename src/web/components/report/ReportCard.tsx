'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { Link } from '@/src/i18n/routing';
import { Heading } from '@/web/components/catalyst/heading';
import { ReportStateBadge } from './ReportStateBadge';
import { User } from '@/domain/user/User';
import { stripMarkdownToPlainText } from '@/application/report/StripMarkdownToPlainText';

interface ReportCardData {
  id: string;
  title: string;
  body: string;
  state: 'DRAFT' | 'PUBLISHED';
  visibility: string;
  lastPublishedAt: string | null;
  createdAt: string;
  archivedAt: string | null;
  organizationId: string;
}

interface AuthorInfo {
  firstName: string;
  lastName: string;
  middleName: string | null;
}

interface ReportCardProps {
  report: ReportCardData;
  author: AuthorInfo;
}

export default function ReportCard({ report, author }: ReportCardProps) {
  const t = useTranslations('report.card');
  const format = useFormatter();

  const authorName = User.formatFullName(
    author.firstName,
    author.lastName,
    author.middleName
  );

  const dateStr = report.lastPublishedAt ?? report.createdAt;
  const date = format.dateTime(new Date(dateStr), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const dateLabel = report.lastPublishedAt
    ? t('publishedAt', { date })
    : t('createdAt', { date });

  const plainBody = stripMarkdownToPlainText(report.body);
  const excerpt =
    plainBody.length > 160 ? plainBody.slice(0, 160) + '…' : plainBody;

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Link
          href={`/reports/${report.id}`}
          className="cursor-pointer hover:underline"
        >
          <Heading level={3} className="text-base/6 sm:text-sm/6">
            {report.title}
          </Heading>
        </Link>
        <ReportStateBadge state={report.state} archived={!!report.archivedAt} />
      </div>

      {excerpt && (
        <p className="mb-3 text-sm text-zinc-600 line-clamp-3 dark:text-zinc-400">
          {excerpt}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{t('by', { name: authorName })}</span>
        <span>{dateLabel}</span>
      </div>
    </article>
  );
}
