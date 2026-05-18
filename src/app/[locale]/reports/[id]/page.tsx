import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Link } from '@/src/i18n/routing';
import { Text } from '@/web/components/catalyst/text';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaReportRepository,
  PrismaReportAttachmentRepository,
  PrismaPollRepository,
  PrismaBoardRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '@/web/lib/session';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { ReportDetail } from '@/web/components/report/ReportDetail';
import { getReportAction } from '@/web/actions/report/report';
import { GetReportForViewerUseCase } from '@/application/report/GetReportForViewerUseCase';
import { ResolveReportVisibilityService } from '@/application/report/ResolveReportVisibilityService';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { stripMarkdownToPlainText } from '@/application/report/StripMarkdownToPlainText';

const SITE_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'https://resolutio.site';

const orgRepo = new PrismaOrganizationRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);
const reportRepo = new PrismaReportRepository(prisma);
const attachmentRepo = new PrismaReportAttachmentRepository(prisma);
const pollRepo = new PrismaPollRepository(prisma);
const boardRepo = new PrismaBoardRepository(prisma);

// Used for the anonymous-visibility peek that decides whether a logged-out
// user should be sent to /r/[id] (publicly viewable) or to /login.
const anonReportUC = new GetReportForViewerUseCase(
  reportRepo,
  new ResolveReportVisibilityService(orgRepo, boardRepo, userRepo),
  attachmentRepo,
  pollRepo
);

interface ReportDetailPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: ReportDetailPageProps): Promise<import('next').Metadata> {
  const { id, locale } = await params;
  const result = await getReportAction({ reportId: id });

  if (!result.success) {
    return { title: 'Report' };
  }

  const { report, attachments } = result.data;

  if (report.visibility !== 'PUBLIC_ANON') {
    return { title: report.title };
  }

  const description = stripMarkdownToPlainText(report.body).slice(0, 160);
  const firstImage = attachments.find((a) => a.mimeType.startsWith('image/'));
  const imageUrl = firstImage
    ? `${SITE_ORIGIN}/api/report-attachments/${firstImage.id}`
    : undefined;

  return {
    title: report.title,
    description,
    openGraph: {
      title: report.title,
      description,
      type: 'article',
      url: `${SITE_ORIGIN}/${locale}/reports/${id}`,
      locale,
      publishedTime: report.lastPublishedAt ?? undefined,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
  };
}

export default async function ReportDetailPage({
  params,
}: ReportDetailPageProps) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    // Logged-out users get the anonymous route if the report is publicly
    // viewable; otherwise we send them to login (the report may exist but be
    // org-only, so the existence isn't leaked either way — /r/[id] 404s for
    // non-public ids).
    const anon = await anonReportUC.execute({
      reportId: id,
      viewerId: null,
    });

    if (anon.success) {
      redirect(`/r/${id}`);
    }

    redirect('/login');
  }

  const user = currentUser;
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
