import { getTranslations } from 'next-intl/server';
import { Link } from '@/src/i18n/routing';
import { Heading } from '@/web/components/catalyst/heading';
import { Text } from '@/web/components/catalyst/text';
import { Button } from '@/web/components/catalyst/button';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { listReportsAction } from '@/web/actions/report/report';
import ReportCard from './ReportCard';

const userRepo = new PrismaUserRepository(prisma);

interface ReportsSectionProps {
  organizationId: string;
  viewerId: string | null;
}

export async function ReportsSection({
  organizationId,
  viewerId: _viewerId,
}: ReportsSectionProps) {
  const t = await getTranslations('report');

  const result = await listReportsAction({
    organizationIds: [organizationId],
    pageSize: 10,
  });

  const reports = result.success ? result.data.reports : [];

  const uniqueAuthorIds = [...new Set(reports.map((r) => r.createdById))];
  const authors = await userRepo.findByIds(uniqueAuthorIds);
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={2}>{t('section.heading')}</Heading>
        <div className="flex gap-2">
          {result.success && result.data.totalCount > 10 && (
            <Link
              href={`/reports?organizationIds=${organizationId}`}
              className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-700 underline dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {t('section.viewAll')}
            </Link>
          )}
          <Link href={`/reports/new?organizationId=${organizationId}`}>
            <Button color="brand-green" className="cursor-pointer">
              {t('section.newButton')}
            </Button>
          </Link>
        </div>
      </div>

      {reports.length === 0 ? (
        <Text className="text-zinc-500 dark:text-zinc-400">
          {t('section.empty')}
        </Text>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {reports.map((report) => {
            const author = authorMap.get(report.createdById);
            const authorInfo = author
              ? {
                  firstName: author.firstName,
                  lastName: author.lastName,
                  middleName: author.middleName ?? null,
                }
              : { firstName: '?', lastName: '?', middleName: null };

            return (
              <ReportCard
                key={report.id}
                report={{
                  id: report.id,
                  title: report.title,
                  body: report.body,
                  state: report.state as 'DRAFT' | 'PUBLISHED',
                  visibility: report.visibility,
                  lastPublishedAt: report.lastPublishedAt,
                  createdAt: report.createdAt,
                  archivedAt: report.archivedAt,
                  organizationId: report.organizationId,
                }}
                author={authorInfo}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
