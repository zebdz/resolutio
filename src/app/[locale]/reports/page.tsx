import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Link } from '@/src/i18n/routing';
import { Heading } from '@/web/components/catalyst/heading';
import { Text } from '@/web/components/catalyst/text';
import { Button } from '@/web/components/catalyst/button';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { getCurrentUser } from '@/web/lib/session';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import ReportCard from '@/web/components/report/ReportCard';
import { listReportsAction } from '@/web/actions/report/report';

const userRepo = new PrismaUserRepository(prisma);

const PAGE_SIZE = 20;

interface ReportsPageProps {
  searchParams: Promise<{
    organizationIds?: string;
    page?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/login');
  }

  const t = await getTranslations('report.pages');
  const sp = await searchParams;

  const rawPage = parseInt(sp.page ?? '1', 10);
  const page = rawPage > 0 ? rawPage : 1;

  const organizationIds = sp.organizationIds
    ? sp.organizationIds.split(',').filter(Boolean)
    : undefined;

  const result = await listReportsAction({
    organizationIds,
    page,
    pageSize: PAGE_SIZE,
  });

  const reports = result.success ? result.data.reports : [];
  const totalCount = result.success ? result.data.totalCount : 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const uniqueAuthorIds = [...new Set(reports.map((r) => r.createdById))];
  const authors = await userRepo.findByIds(uniqueAuthorIds);
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  function buildPageHref(p: number) {
    const params = new URLSearchParams();
    params.set('page', String(p));

    if (sp.organizationIds) {
      params.set('organizationIds', sp.organizationIds);
    }

    return `/reports?${params.toString()}`;
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Heading className="text-3xl font-bold">{t('feedTitle')}</Heading>
          <Link href="/reports/new">
            <Button color="brand-green" className="cursor-pointer">
              {t('newButton')}
            </Button>
          </Link>
        </div>

        {reports.length === 0 ? (
          <Text className="text-zinc-500 dark:text-zinc-400">
            {t('feedEmpty')}
          </Text>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4">
            <Link href={buildPageHref(page - 1)}>
              <Button
                outline
                disabled={page <= 1}
                className="cursor-pointer disabled:cursor-not-allowed"
              >
                {t('previous')}
              </Button>
            </Link>

            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('page', { page })}
            </Text>

            <Link href={buildPageHref(page + 1)}>
              <Button
                outline
                disabled={page >= totalPages}
                className="cursor-pointer disabled:cursor-not-allowed"
              >
                {t('next')}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
