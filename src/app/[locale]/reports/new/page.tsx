import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Link } from '@/src/i18n/routing';
import { Heading } from '@/web/components/catalyst/heading';
import { Text } from '@/web/components/catalyst/text';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaPollRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '@/web/lib/session';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { ReportForm } from '@/web/components/report/ReportForm';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';

const orgRepo = new PrismaOrganizationRepository(prisma);
const boardRepo = new PrismaBoardRepository(prisma);
const pollRepo = new PrismaPollRepository(prisma);

interface NewReportPageProps {
  searchParams: Promise<{ organizationId?: string }>;
}

export default async function NewReportPage({
  searchParams,
}: NewReportPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/login');
  }

  const user = currentUser;
  const t = await getTranslations('report.pages');
  const sp = await searchParams;
  const organizationId = sp.organizationId;

  if (!organizationId) {
    const memberships = await orgRepo.findMembershipsByUserId(user.id);

    return (
      <AuthenticatedLayout>
        <div className="space-y-6">
          <Heading className="text-2xl font-bold">{t('pickOrg')}</Heading>
          {memberships.length === 0 ? (
            <Text className="text-zinc-500 dark:text-zinc-400">
              {t('noOrgsCallout')}
            </Text>
          ) : (
            <ul className="space-y-2">
              {memberships.map((org) => (
                <li key={org.id}>
                  <Link
                    href={`/reports/new?organizationId=${org.id}`}
                    className="cursor-pointer block rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700"
                  >
                    {org.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AuthenticatedLayout>
    );
  }

  const isMember = await orgRepo.isUserExactMember(user.id, organizationId);

  if (!isMember) {
    return (
      <AuthenticatedLayout>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <Text className="text-red-800 dark:text-red-200">
            {t('unauthorized')}
          </Text>
        </div>
      </AuthenticatedLayout>
    );
  }

  const [boards, pollsResult] = await Promise.all([
    boardRepo.findByOrganizationId(organizationId),
    pollRepo.searchPolls({ organizationId, pageSize: 200 }, user.id),
  ]);

  const orgBoards = boards.map((b) => ({ id: b.id, name: b.name }));

  const orgPolls = pollsResult.success
    ? pollsResult.value.polls.map((p) => ({
        id: p.id,
        title: p.title,
        organizationId: p.organizationId,
        boardId: p.boardId ?? null,
        archivedAt: p.archivedAt?.toISOString() ?? null,
        state: p.state,
      }))
    : [];

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <Link
            href={`/organizations/${organizationId}`}
            className="cursor-pointer inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            {t('backToDetail')}
          </Link>
          <Heading className="text-2xl font-bold">{t('newTitle')}</Heading>
        </div>

        <ReportForm
          mode="create"
          organizationId={organizationId}
          orgBoards={orgBoards}
          orgPolls={orgPolls}
        />
      </div>
    </AuthenticatedLayout>
  );
}
