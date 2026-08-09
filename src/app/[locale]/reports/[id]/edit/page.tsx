import { getLocale, getTranslations } from 'next-intl/server';

import { Link } from '@/src/i18n/routing';
import { Heading } from '@/web/components/catalyst/heading';
import { Text } from '@/web/components/catalyst/text';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaPollRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '@/web/lib/session';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { ReportForm } from '@/web/components/report/ReportForm';
import { getReportAction } from '@/web/actions/report/report';
import { ReportVisibility } from '@/domain/report/ReportVisibility';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { redirectLocalized } from '@/web/lib/redirectLocalized';

const orgRepo = new PrismaOrganizationRepository(prisma);
const boardRepo = new PrismaBoardRepository(prisma);
const pollRepo = new PrismaPollRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);

interface EditReportPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditReportPage({ params }: EditReportPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirectLocalized(await getLocale(), '/login');
  }

  const user = currentUser;
  const { id } = await params;
  const t = await getTranslations('report');
  const result = await getReportAction({ reportId: id });

  if (!result.success) {
    return (
      <AuthenticatedLayout>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <Text className="text-red-800 dark:text-red-200">{result.error}</Text>
        </div>
      </AuthenticatedLayout>
    );
  }

  const { report, attachments } = result.data;

  if (report.state !== 'DRAFT') {
    return (
      <AuthenticatedLayout>
        <div className="space-y-4">
          <Text className="text-zinc-700 dark:text-zinc-300">
            {t('pages.cannotEditPublished')}
          </Text>
          <Link
            href={`/reports/${id}`}
            className="cursor-pointer inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            {t('pages.backToDetail')}
          </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  const [isAdmin, isSuperAdmin] = await Promise.all([
    orgRepo.isUserAdmin(user.id, report.organizationId),
    userRepo.isSuperAdmin(user.id),
  ]);

  const isAuthor = report.createdById === user.id;

  if (!isAuthor && !isAdmin && !isSuperAdmin) {
    return (
      <AuthenticatedLayout>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <Text className="text-red-800 dark:text-red-200">
            {t('errors.notAuthorOrAdmin')}
          </Text>
        </div>
      </AuthenticatedLayout>
    );
  }

  const [boards, pollsResult] = await Promise.all([
    boardRepo.findByOrganizationId(report.organizationId),
    pollRepo.searchPolls(
      { organizationId: report.organizationId, pageSize: 200 },
      user.id
    ),
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

  const attachmentsMeta = attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
  }));

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <Link
            href={`/reports/${id}`}
            className="cursor-pointer inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            {t('pages.backToDetail')}
          </Link>
          <Heading className="text-2xl font-bold">{report.title}</Heading>
        </div>

        <ReportForm
          mode="edit"
          organizationId={report.organizationId}
          orgBoards={orgBoards}
          orgPolls={orgPolls}
          existingReport={{
            id: report.id,
            title: report.title,
            body: report.body,
            visibility: report.visibility as ReportVisibility,
            boardIds: report.boardIds,
            pollIds: report.pollIds,
            attachments: attachmentsMeta,
          }}
        />
      </div>
    </AuthenticatedLayout>
  );
}
