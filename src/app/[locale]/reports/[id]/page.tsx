import { getLocale, getTranslations } from 'next-intl/server';

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
import { serializeReport } from '@/web/actions/report/serializeReport';
import { GetReportForViewerUseCase } from '@/application/report/GetReportForViewerUseCase';
import { ResolveReportVisibilityService } from '@/application/report/ResolveReportVisibilityService';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { stripMarkdownToPlainText } from '@/application/shared/StripMarkdownToPlainText';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { redirectLocalized } from '@/web/lib/redirectLocalized';

const SITE_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'https://resolutio.site';

const orgRepo = new PrismaOrganizationRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);
const reportRepo = new PrismaReportRepository(prisma);
const attachmentRepo = new PrismaReportAttachmentRepository(prisma);
const pollRepo = new PrismaPollRepository(prisma);
const boardRepo = new PrismaBoardRepository(prisma);

// Visibility-aware fetch used by both anon and authenticated viewers. The
// service evaluates canRead with the supplied viewerId; null = anonymous.
const reportUC = new GetReportForViewerUseCase(
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
  // Anonymous metadata fetch — keeps OG generation working for crawlers
  // that won't have a session cookie.
  const result = await reportUC.execute({ reportId: id, viewerId: null });

  if (!result.success) {
    return { title: 'Report' };
  }

  const { report, attachments } = result.value;

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
      publishedTime: report.lastPublishedAt?.toISOString() ?? undefined,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
  };
}

export default async function ReportDetailPage({
  params,
}: ReportDetailPageProps) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  const t = await getTranslations('report');

  const result = await reportUC.execute({
    reportId: id,
    viewerId: currentUser?.id ?? null,
  });

  if (!result.success) {
    // Not visible to this viewer. Anonymous → bounce to login (might be a
    // member who got logged out); authenticated → render error inline
    // (existence not leaked: REPORT_NOT_FOUND covers both "doesn't exist"
    // and "not visible to you").
    if (!currentUser) {
      redirectLocalized(await getLocale(), '/login');
    }

    const errorMessage = await translateErrorCode(result.error);

    return (
      <AuthenticatedLayout>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <Text className="text-red-800 dark:text-red-200">{errorMessage}</Text>
        </div>
      </AuthenticatedLayout>
    );
  }

  const { report, attachments, polls } = result.value;

  const [authorUser, isAdmin, isSuperAdmin] = currentUser
    ? await Promise.all([
        userRepo.findById(report.createdById),
        orgRepo.isUserAdmin(currentUser.id, report.organizationId),
        userRepo.isSuperAdmin(currentUser.id),
      ])
    : [await userRepo.findById(report.createdById), false, false];

  const author = authorUser
    ? {
        firstName: authorUser.firstName,
        lastName: authorUser.lastName,
        middleName: authorUser.middleName ?? null,
      }
    : { firstName: '?', lastName: '?', middleName: null };

  const isAuthor = !!currentUser && report.createdById === currentUser.id;

  const serializedReport = serializeReport(report);
  const serializedAttachments = attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt.toISOString(),
  }));
  const serializedPolls = polls.map((p) => ({
    id: p.id,
    title: p.title,
    state: p.state,
    archivedAt: p.archivedAt?.toISOString() ?? null,
  }));

  const viewer = currentUser
    ? { id: currentUser.id, isAuthor, isAdmin, isSuperAdmin }
    : null;

  const body = (
    <div className="space-y-6">
      <Link
        href="/reports"
        className="cursor-pointer inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {t('pages.feedTitle')}
      </Link>

      <ReportDetail
        report={serializedReport}
        author={author}
        attachments={serializedAttachments}
        polls={serializedPolls}
        viewer={viewer}
      />
    </div>
  );

  if (!currentUser) {
    // Anonymous viewer: skip the authenticated chrome (navbar, sidebar)
    // and render the report standalone, same as /r/[id].
    return <main className="mx-auto max-w-3xl px-4 py-8">{body}</main>;
  }

  return <AuthenticatedLayout>{body}</AuthenticatedLayout>;
}
