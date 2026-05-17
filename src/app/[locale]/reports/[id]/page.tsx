import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Link } from '@/src/i18n/routing';
import { Text } from '@/web/components/catalyst/text';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '@/web/lib/session';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { ReportDetail } from '@/web/components/report/ReportDetail';
import { getReportAction } from '@/web/actions/report/report';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';

const orgRepo = new PrismaOrganizationRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);

interface ReportDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ReportDetailPageProps) {
  const { id } = await params;
  const result = await getReportAction({ reportId: id });

  if (!result.success) {
    return { title: 'Report' };
  }

  return { title: result.data.report.title };
}

export default async function ReportDetailPage({
  params,
}: ReportDetailPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/login');
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

  const { report, attachments, polls } = result.data;

  const [authorUser, isAdmin, isSuperAdmin] = await Promise.all([
    userRepo.findById(report.createdById),
    orgRepo.isUserAdmin(user.id, report.organizationId),
    userRepo.isSuperAdmin(user.id),
  ]);

  const author = authorUser
    ? {
        firstName: authorUser.firstName,
        lastName: authorUser.lastName,
        middleName: authorUser.middleName ?? null,
      }
    : { firstName: '?', lastName: '?', middleName: null };

  const isAuthor = report.createdById === user.id;

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <Link
          href="/reports"
          className="cursor-pointer inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t('pages.feedTitle')}
        </Link>

        <ReportDetail
          report={report}
          author={author}
          attachments={attachments}
          polls={polls}
          viewer={{ id: user.id, isAuthor, isAdmin, isSuperAdmin }}
        />
      </div>
    </AuthenticatedLayout>
  );
}
